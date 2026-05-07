# STYLE_CONSISTENCY_AUDIT

## 审计范围

- 企业端：`/`、`/alarm-center`、`/devices`、`/spaces`、`/duty-center`、`/inspection`、`/notification-center`、`/audit-log`、`/system-health`、`/users`、`/history`、`/settings`、`/subscription`
- 平台端：`/admin`、`/admin/tenants`、`/admin/plans`、`/admin/subscriptions`、`/admin/users`、`/admin/features`
- 公共组件：`PageHeader`、`SectionCard`、`StatusBadge`、`Dialog`、`PaginationBar`、表格、按钮、筛选条、空状态、表单输入

## 发现的样式不统一问题

1. 状态标签
   - `components/status-badge.tsx` 已存在，但状态映射不完整。
   - `/notification-center` 使用 `sky/rose/emerald/amber` 手写通知状态。
   - `/audit-log` 使用手写成功/失败标签。
   - `/users` 使用手写短信开启/关闭标签和消息类型标签。
   - `/subscription` 使用 `emerald/slate` 手写功能开启状态。
   - `/history` 原始事件级别使用页面内手写标签。
   - 首页地图图例和部分 dashboard 指标仍有手写状态 chip。

2. 按钮
   - 大部分新增、编辑、删除按钮已经使用 `sf-button`，但 `/history`、`/subscription`、账号/profile 类页面、部分 workspace legacy 组件仍保留 `sky-*`、`emerald-*` 按钮。
   - 筛选按钮在 `/devices`、`/users`、`/settings`、`/history` 中结构相似，但有页面内拼接样式。
   - 分页按钮已有 `PaginationBar`，但 `/users` 仍手写分页条。

3. 表格和列表
   - `/devices`、`/admin/tenants` 已使用 `sf-table-shell`、`sf-table-head`、交替行和 hover。
   - `/users` 表格接近统一，但分页条未走公共组件，短信状态和消息类型 chip 手写。
   - `/audit-log` 表格使用公共壳，但结果状态手写。
   - `/history` 两张明细表使用页面内 `rounded-2xl` 表格壳、`sticky top-0 bg-[var(--surface-strong)]` 表头，和 `sf-table-shell` 不一致。
   - `/system-health` 最近设备事件表格使用页面内壳和表头样式。
   - `/notification-center` 以列表为主，列表卡片统一，但通知渠道、等级、发送状态 chip 手写颜色。

4. 卡片/面板
   - 主要业务页基本使用 `PageHeader` + `SectionCard`。
   - `/history` 内部统计块仍用 `rounded-2xl/rounded-3xl` 自定义面板，视觉上比其他业务页更厚。
   - `/system-health` 错误日志用 `rounded-[16px]` 自定义危险卡片。
   - `/subscription`、profile 类页面有旧的 `sky/emerald/slate` SaaS 浅色 chip。
   - 企业端首页和 spaces 页面有大屏/空间建模专用面板风格，保留为业务特例，不纳入普通业务页强制改造。

5. 弹窗和表单
   - 新增/编辑设备、用户、企业、套餐、订阅均已使用 `Dialog` 和 `sf-input`。
   - `Dialog` 的 header/footer 仍包含偏白的固定背景值，在企业端暗色主题下与 token 化面板存在轻微割裂。
   - 设备表单有校验错误状态，用户/平台表单错误提示覆盖较少，但本轮不改变业务校验逻辑。

6. 页面壳层
   - 企业端统一走 `app/(platform)/layout.tsx` + `TopNavigation`。
   - 平台端统一走 `SaaSShell`，但侧栏/顶部仍有少量硬编码 `#24384d/#1f3a56`，属于平台浅色管理端风格，不影响业务页一致性；后续可 token 化。
   - 普通业务页外层 `space-y-2.5` 与首页/空间页专用布局混用，符合当前视觉方向。

## 重复写了不同样式的组件

- 按钮：`sf-button` 已有，但仍有页面内 `rounded-full border border-sky-200 bg-sky-50`。
- 状态标签：`StatusBadge` 已有，但页面内还有 `rounded-full border ... bg-*`。
- 表格：`sf-table-shell`/`sf-table-head` 已有，但 `/history`、`/system-health` 仍手写表格壳。
- 筛选条：`sf-toolbar` 已有，但缺少公共 `FilterBar` 组件。
- 空状态/加载态：多个页面通过文字或空列表自然展示，缺少统一 `EmptyState`、`LoadingState`。
- 表单：`sf-input` 已有，但缺少公共 input/select/textarea class 导出。

## 需要统一到公共组件的位置

- `components/status-badge.tsx`：扩展为全项目状态映射入口。
- 新增 `ActionButton`：统一主操作、次级、危险、警告、筛选、表格操作按钮的尺寸和状态。
- 新增 `DataTable` 辅助组件：统一表格壳、表头、行、单元格和空状态。
- 新增 `FilterBar`：统一筛选区域容器。
- 新增 `EmptyState` / `LoadingState` / `Tooltip` / 表单 class helper：补齐公共 UI surface。
- `/users`、`/audit-log`、`/history`、`/system-health`、`/notification-center`、`/subscription`：优先替换手写状态标签、按钮、表格壳和分页条。

## 保留不改的业务特例

- 企业端首页大屏面板、地图/CAD 面板、实时可视化面板。
- `/spaces` 空间建模页面的 CAD/图纸/点位专用布局。
- 平台端 `SaaSShell` 的整体浅色 SaaS 管理端方向。
