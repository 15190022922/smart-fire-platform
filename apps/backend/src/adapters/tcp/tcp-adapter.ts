import type { SharedNormalizedDeviceEvent } from "../../../../../packages/shared/src/contracts";

export type TcpAdapterOptions = {
  port?: number;
};

export class TcpAdapter {
  constructor(private readonly options: TcpAdapterOptions = {}) {}

  start() {
    if (!this.options.port) {
      return;
    }
    console.log(`[tcp-adapter] skeleton ready on port ${this.options.port}`);
  }

  stop() {
    return;
  }

  normalizePacket(packet: Buffer): SharedNormalizedDeviceEvent | null {
    void packet;
    return null;
  }
}
