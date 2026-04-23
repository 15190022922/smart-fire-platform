import type { IncomingMessage, ServerResponse } from "http";
import { processIngestionEvent } from "../../../../../services/ingestion/ingestion-service";
import { validateIngestionEventInput } from "../../../../../services/ingestion/ingestion-validator";
import { readJsonBody, sendJson } from "../../lib/http";
import type { BackendRequestContext } from "../auth/auth-context";
import { requirePlatformContext } from "../auth/auth-controller";

export async function postIngestionEvent(
  req: IncomingMessage,
  res: ServerResponse,
  context: BackendRequestContext,
) {
  if (!requirePlatformContext(res, context)) return;

  const body = await readJsonBody(req);
  const validated = validateIngestionEventInput(body);
  if (!validated.success) {
    sendJson(res, 400, { message: validated.message });
    return;
  }

  try {
    const result = await processIngestionEvent({
      ...validated.data,
      source: "backend_api",
    });
    sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof Error && error.message === "DEVICE_NOT_FOUND") {
      sendJson(res, 404, { message: "未找到对应设备" });
      return;
    }
    sendJson(res, 500, { message: "设备接入处理失败" });
  }
}
