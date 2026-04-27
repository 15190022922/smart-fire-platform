# DEPLOY_CHECKLIST

## 1. 环境变量
- `DATABASE_URL`
- `BACKEND_PORT`
- `BACKEND_BASE_URL`
- `NOTIFICATION_FORCE_FAIL`（仅测试环境使用）

建议准备 `.env.production` 模板，并与开发环境隔离。

## 2. PostgreSQL
- 已安装并可连接
- 已完成 schema 初始化
- 校验：

```bash
psql "$DATABASE_URL" -c "SELECT 1;"
```

## 3. 前后端构建

```bash
npm install
npm run build
npm run build:backend
```

## 4. PM2 进程
- `smart-fire-web`
- `smart-fire-backend`

校验：

```bash
pm2 status
pm2 logs smart-fire-web --lines 50
pm2 logs smart-fire-backend --lines 50
```

## 5. Nginx 反向代理
- 80/443 -> `web:3000`
- `/api/` 仍走 web，由 web 转发 backend 兼容层或直接到 backend
- 建议同时保留 backend 内网 4001，不直接暴露公网

## 6. 端口
- 3000：web
- 4001：backend（建议仅内网）
- 22：SSH
- 80/443：Nginx

## 7. HTTPS 预留
- 为域名预留 443
- Nginx 中准备 `server_name`
- 证书可后续接入 Certbot 或云证书

## 8. 安全组
- 开放 22、80、443
- 不建议公网开放 4001 和数据库 5432

## 9. 数据库备份
- 上线前至少做一次全量备份
- 保留恢复命令和最近一次备份文件路径

## 10. 联调验收
- 首页可打开
- `/alarm-center`
- `/devices`
- `/duty-center`
- `/inspection`
- `/notification-center`
- `/audit-log`
- `/system-health`
- `/api/ingestion/event` 可用

## 11. 自动化测试

```bash
npm run test:backend
```

若已启动 web + backend：

```bash
$env:SMART_FIRE_WEB_BASE_URL="http://127.0.0.1:3000"
npm run test:web
```

## 12. 上线前人工检查
- 平台管理员可登录
- 企业管理员可登录
- 新增设备正常
- ingestion 报警链路正常
- 通知记录生成正常
- 审计日志可查看
- 多租户互相隔离
