当前阶段的 Web 仍运行在仓库根目录的 Next.js 项目中。

这里保留 `apps/web` 目录，是为了按 monorepo 目标逐步迁移。
本轮已经优先把 backend、shared、database、realtime 独立出来，并让前端开始调用 backend。
