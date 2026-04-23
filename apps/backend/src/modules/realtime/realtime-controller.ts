import type { IncomingMessage, ServerResponse } from "http";
import { subscribeTenantEvents } from "../../../../../packages/realtime/src/server";
import { setSseHeaders } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requireTenantContext } from "../auth/auth-controller";

function writeEvent(res: ServerResponse, event: string, data: string) {
  res.write(`event: ${event}\ndata: ${data}\n\n`);
}

export function openRealtimeStream(req: IncomingMessage, res: ServerResponse, context: BackendRequestContext) {
  if (!requireTenantContext(res, context)) return;

  setSseHeaders(res);
  writeEvent(
    res,
    "connected",
    JSON.stringify({
      tenantId: context.tenantId,
      serverTime: new Date().toISOString(),
    }),
  );

  const unsubscribe = subscribeTenantEvents(context.tenantId!, (payload: string) => {
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
