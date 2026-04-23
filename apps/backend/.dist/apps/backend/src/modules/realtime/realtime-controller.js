"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openRealtimeStream = openRealtimeStream;
const server_1 = require("../../../../../packages/realtime/src/server");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
function writeEvent(res, event, data) {
    res.write(`event: ${event}\ndata: ${data}\n\n`);
}
function openRealtimeStream(req, res, context) {
    if (!(0, auth_controller_1.requireTenantContext)(res, context))
        return;
    (0, http_1.setSseHeaders)(res);
    writeEvent(res, "connected", JSON.stringify({
        tenantId: context.tenantId,
        serverTime: new Date().toISOString(),
    }));
    const unsubscribe = (0, server_1.subscribeTenantEvents)(context.tenantId, (payload) => {
        writeEvent(res, "update", payload);
    });
    const heartbeat = setInterval(() => {
        writeEvent(res, "ping", JSON.stringify({ serverTime: new Date().toISOString() }));
    }, 12000);
    req.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
    });
}
