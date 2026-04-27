# PRESSURE_TEST

## 目标
- 验证 `/api/ingestion/event` 高频写入稳定性。
- 验证报警生成链路是否阻塞。
- 验证 realtime 推送是否成为瓶颈。
- 验证 notification 写入是否拖慢主链路。

## 脚本
- 文件：`scripts/pressure/ingestion-pressure.ts`
- 命令：

```bash
npm run pressure:ingestion
```

## 环境变量
- `SMART_FIRE_BACKEND_BASE_URL`
  - 默认：`http://127.0.0.1:4001`
- `SMART_FIRE_TENANT_ID`
  - 默认：`tenant-huaxing`
- `SMART_FIRE_DEVICE_PREFIX`
  - 默认：`device-hx`
- `SCENARIO`
  - `single-device`
  - `multi-device`
  - `duplicate-event`
  - `heartbeat-storm`
- `TOTAL_EVENTS`
  - 默认：`100`
- `CONCURRENCY`
  - 默认：`10`

## 场景 1：单设备连续事件

```bash
$env:SCENARIO="single-device"
$env:TOTAL_EVENTS="200"
$env:CONCURRENCY="5"
npm run pressure:ingestion
```

关注：
- 平均耗时
- TPS
- 是否出现 5xx

## 场景 2：多设备并发事件

```bash
$env:SCENARIO="multi-device"
$env:TOTAL_EVENTS="300"
$env:CONCURRENCY="20"
npm run pressure:ingestion
```

关注：
- 报警中心是否仍能正常创建/更新
- system-health 的 ingestion TPS、告警耗时是否明显恶化

## 场景 3：重复事件

```bash
$env:SCENARIO="duplicate-event"
$env:TOTAL_EVENTS="50"
$env:CONCURRENCY="10"
npm run pressure:ingestion
```

关注：
- 重复事件是否被 suppress
- 不应重复创建正式报警

## 场景 4：心跳风暴

```bash
$env:SCENARIO="heartbeat-storm"
$env:TOTAL_EVENTS="500"
$env:CONCURRENCY="50"
npm run pressure:ingestion
```

关注：
- 心跳事件是否压垮主链路
- 实时连接数和通知失败数是否异常上升

## 建议验收阈值
- 5xx = 0
- 单次告警生成链路平均耗时 < 500ms
- ingestion TPS 在测试负载下稳定，无明显长尾
- 重复事件不重复建报警
- 心跳风暴下正式报警链路不阻塞
