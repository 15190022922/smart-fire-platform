"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postIngestionEvent = postIngestionEvent;
const ingestion_service_1 = require("../../../../../services/ingestion/ingestion-service");
const ingestion_validator_1 = require("../../../../../services/ingestion/ingestion-validator");
const http_1 = require("../../lib/http");
const auth_controller_1 = require("../auth/auth-controller");
async function postIngestionEvent(req, res, context) {
    if (!(0, auth_controller_1.requirePlatformContext)(res, context))
        return;
    const body = await (0, http_1.readJsonBody)(req);
    const validated = (0, ingestion_validator_1.validateIngestionEventInput)(body);
    if (!validated.success) {
        (0, http_1.sendJson)(res, 400, { message: validated.message });
        return;
    }
    try {
        const result = await (0, ingestion_service_1.processIngestionEvent)({
            ...validated.data,
            source: "backend_api",
        });
        (0, http_1.sendJson)(res, 200, result);
    }
    catch (error) {
        if (error instanceof Error && error.message === "DEVICE_NOT_FOUND") {
            (0, http_1.sendJson)(res, 404, { message: "未找到对应设备" });
            return;
        }
        (0, http_1.sendJson)(res, 500, { message: "设备接入处理失败" });
    }
}
