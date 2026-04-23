# 硬件接入与空间建模设计

## 目标

为多企业 SaaS 版智慧消防平台预留真实硬件接入能力，并让每个企业可以维护自己的园区、楼栋、楼层、图纸和设备点位。

## 分层

1. 租户层
   - 所有站点、图纸、设备、事件、状态快照都必须带 `tenant_id`
2. 空间模型层
   - `tenant_sites`
   - `tenant_buildings`
   - `tenant_floors`
   - `tenant_drawings`
   - `tenant_device_points`
3. 设备接入层
   - `tenant_gateways`
   - 后续可对接 MQTT、TCP、厂商网关
4. 原始事件层
   - `raw_device_events`
   - 保存未经业务规则处理的原始上报
5. 运行态层
   - `device_status_snapshots`
   - 首页、图纸和设备列表优先读取快照

## 后续推荐接口

- `POST /api/tenant/drawings`
  - 上传或登记图纸
- `POST /api/tenant/device-points`
  - 保存设备布点
- `POST /api/ingest/device-events`
  - 接收网关或接入服务上报的标准化事件
- `GET /api/tenant/spatial-model`
  - 获取企业当前空间模型与接入准备数据

## 关键原则

- 原始设备事件和正式报警记录不要混表
- 设备当前状态和历史事件不要混表
- 图纸坐标不要写死在前端静态文件
- 企业之间的数据隔离必须依赖 `tenant_id`，不能只靠前端过滤
