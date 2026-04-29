"use client";

import { useEffect } from "react";

const TENANT_STORAGE_KEY = "smart-fire-tenant-session-token";
const PLATFORM_STORAGE_KEY = "smart-fire-platform-session-token";

function shouldAttachTenantSession(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  if (url.startsWith("/api/tenant/")) return true;
  if (url.startsWith(`${window.location.origin}/api/tenant/`)) return true;
  return false;
}

function shouldAttachPlatformSession(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  if (url.startsWith("/api/platform/")) return true;
  if (url.startsWith("/api/admin/")) return true;
  if (url.startsWith("/api/ingestion/")) return true;
  if (url.startsWith("/api/ingest/")) return true;
  if (url.startsWith(`${window.location.origin}/api/platform/`)) return true;
  if (url.startsWith(`${window.location.origin}/api/admin/`)) return true;
  if (url.startsWith(`${window.location.origin}/api/ingestion/`)) return true;
  if (url.startsWith(`${window.location.origin}/api/ingest/`)) return true;
  return false;
}

export function getPinnedTenantSessionToken() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(TENANT_STORAGE_KEY) ?? "";
}

export function getPinnedPlatformSessionToken() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(PLATFORM_STORAGE_KEY) ?? "";
}

export function TenantSessionBridge({ token }: { token: string }) {
  useEffect(() => {
    if (!token) return;
    window.sessionStorage.setItem(TENANT_STORAGE_KEY, token);
  }, [token]);

  useSmartFireSessionFetchPatch();

  return null;
}

export function PlatformSessionBridge({ token }: { token: string }) {
  useEffect(() => {
    if (!token) return;
    window.sessionStorage.setItem(PLATFORM_STORAGE_KEY, token);
  }, [token]);

  useSmartFireSessionFetchPatch();

  return null;
}

function useSmartFireSessionFetchPatch() {
  useEffect(() => {
    if ((window as typeof window & { __smartFireFetchPatched?: boolean }).__smartFireFetchPatched) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const pinnedToken = shouldAttachTenantSession(input)
        ? getPinnedTenantSessionToken()
        : shouldAttachPlatformSession(input)
          ? getPinnedPlatformSessionToken()
          : "";
      if (!pinnedToken) {
        return originalFetch(input, init);
      }

      const headers = new Headers(init.headers);
      headers.set("x-smart-fire-session", pinnedToken);
      return originalFetch(input, { ...init, headers });
    };

    (window as typeof window & { __smartFireFetchPatched?: boolean }).__smartFireFetchPatched = true;
  }, []);
}
