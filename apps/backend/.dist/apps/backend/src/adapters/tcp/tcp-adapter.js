"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TcpAdapter = void 0;
class TcpAdapter {
    constructor(options = {}) {
        this.options = options;
    }
    start() {
        if (!this.options.port) {
            return;
        }
        console.log(`[tcp-adapter] skeleton ready on port ${this.options.port}`);
    }
    stop() {
        return;
    }
    normalizePacket(packet) {
        void packet;
        return null;
    }
}
exports.TcpAdapter = TcpAdapter;
