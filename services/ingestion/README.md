# ingestion

设备接入服务预留目录。

目标职责：
- 接收设备原始事件
- 协议适配
- 统一写入 `raw_event -> status -> alarm`
- 设备身份校验与去重

当前阶段：
- 仍由 `/api/ingest/device-events` 承担基础接入逻辑
