"use client";

import type { RealtimeConnectionState, RealtimeEnvelope, RealtimeEventType } from "@/types/realtime";
import { getPinnedTenantSessionToken } from "@/components/auth/tenant-session-bridge";

type Subscriber = {
  id: string;
  types?: RealtimeEventType[];
  onEvent: (event: RealtimeEnvelope) => void;
  onState?: (state: RealtimeConnectionState, latencyMs: number) => void;
};

class TenantEventBus {
  private eventSource: EventSource | null = null;
  private subscribers = new Map<string, Subscriber>();
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private seenIds = new Set<string>();
  private seenQueue: string[] = [];
  private state: RealtimeConnectionState = "connecting";
  private lastLatencyMs = 0;
  private lastHeartbeatAt = 0;

  subscribe(subscriber: Omit<Subscriber, "id">) {
    const id = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.subscribers.set(id, { id, ...subscriber });
    subscriber.onState?.(this.state, this.lastLatencyMs);
    this.ensureConnected();

    return () => {
      this.subscribers.delete(id);
      if (this.subscribers.size === 0) {
        this.teardown();
      }
    };
  }

  getSnapshot() {
    return { state: this.state, latencyMs: this.lastLatencyMs };
  }

  private ensureConnected() {
    if (this.eventSource || this.subscribers.size === 0) {
      return;
    }

    this.setState("connecting");
    const pinnedToken = getPinnedTenantSessionToken();
    const eventSourceUrl = pinnedToken
      ? `/api/tenant/realtime-events?session=${encodeURIComponent(pinnedToken)}`
      : "/api/tenant/realtime-events";
    const eventSource = new EventSource(eventSourceUrl);
    this.eventSource = eventSource;

    eventSource.onopen = () => {
      this.lastHeartbeatAt = Date.now();
      this.setState("connected");
      this.startHeartbeatWatch();
    };

    eventSource.onerror = () => {
      this.setState("reconnecting");
      this.scheduleReconnect();
    };

    eventSource.addEventListener("connected", () => {
      this.lastHeartbeatAt = Date.now();
      this.setState("connected");
    });

    eventSource.addEventListener("ping", () => {
      this.lastHeartbeatAt = Date.now();
    });

    eventSource.addEventListener("update", (raw) => {
      this.lastHeartbeatAt = Date.now();

      try {
        const event = JSON.parse((raw as MessageEvent<string>).data) as RealtimeEnvelope;
        if (this.seenIds.has(event.eventId)) {
          return;
        }
        this.pushSeen(event.eventId);
        this.lastLatencyMs = event.latencyMs ?? 0;

        for (const subscriber of this.subscribers.values()) {
          if (!subscriber.types || subscriber.types.includes(event.type)) {
            subscriber.onEvent(event);
          }
          subscriber.onState?.(this.state, this.lastLatencyMs);
        }
      } catch {
        // Ignore malformed payload and keep stream alive.
      }
    });
  }

  private setState(nextState: RealtimeConnectionState) {
    this.state = nextState;
    for (const subscriber of this.subscribers.values()) {
      subscriber.onState?.(this.state, this.lastLatencyMs);
    }
  }

  private pushSeen(eventId: string) {
    this.seenIds.add(eventId);
    this.seenQueue.push(eventId);
    if (this.seenQueue.length > 200) {
      const removed = this.seenQueue.shift();
      if (removed) {
        this.seenIds.delete(removed);
      }
    }
  }

  private startHeartbeatWatch() {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.eventSource) {
        return;
      }
      const elapsed = Date.now() - this.lastHeartbeatAt;
      if (elapsed > 25000) {
        this.setState("stale");
        this.scheduleReconnect();
      }
    }, 5000);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.subscribers.size === 0) {
      return;
    }
    this.closeSource();
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected();
    }, 2000);
  }

  private closeSource() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private teardown() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.closeSource();
    this.seenIds.clear();
    this.seenQueue = [];
    this.state = "connecting";
    this.lastLatencyMs = 0;
    this.lastHeartbeatAt = 0;
  }
}

let singletonBus: TenantEventBus | null = null;

export function getTenantEventBus() {
  if (!singletonBus) {
    singletonBus = new TenantEventBus();
  }
  return singletonBus;
}
