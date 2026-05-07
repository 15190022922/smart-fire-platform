import { cn } from "@/lib/cn";
import { normalizeLegacyStatusText } from "@/packages/shared/src/legacy-text";

type BadgeTone = "success" | "danger" | "warning" | "info" | "neutral" | "purple";

const toneClassMap: Record<BadgeTone, string> = {
  success: "border-[color:var(--border-soft)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  danger: "border-[color:var(--border-soft)] bg-[var(--danger-soft)] text-[var(--danger-strong)]",
  warning: "border-[color:var(--border-soft)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
  info: "border-[color:var(--border-soft)] bg-[var(--info-soft)] text-[var(--accent-strong)]",
  neutral: "border-[color:var(--border-soft)] bg-[var(--neutral-soft)] text-[color:var(--text-secondary)]",
  purple: "border-[color:var(--border-soft)] bg-[var(--accent-soft)] text-[color:var(--accent-strong)]",
};

const statusToneMap: Record<string, BadgeTone> = {
  // 设备状态
  正常: "success",
  在线: "success",
  报警: "danger",
  故障: "warning",
  离线: "neutral",
  维修中: "info",
  维保中: "info",

  // 报警状态
  未处理: "danger",
  已确认: "info",
  已处理: "info",
  处理中: "warning",
  已完成: "success",
  已关闭: "neutral",
  误报: "purple",
  跨日: "purple",

  // 订阅 / 企业 / 功能状态
  启用: "success",
  开启: "success",
  生效: "success",
  已生效: "success",
  试用: "info",
  试用中: "info",
  正式订阅: "success",
  即将到期: "warning",
  已过期: "neutral",
  过期: "neutral",
  停用: "neutral",
  已停用: "neutral",
  已关闭功能: "neutral",
  未分配: "neutral",

  // 通知 / 审计 / 通用状态
  已发送: "success",
  发送成功: "success",
  成功: "success",
  失败: "danger",
  发送失败: "danger",
  排队中: "warning",
  待发送: "warning",
  已开启: "success",
  已开通: "success",
  已禁用: "neutral",
  未开通: "neutral",
  已禁用通知: "neutral",
  短信: "info",
  站内通知: "info",
  报警信息: "danger",
  故障信息: "warning",
  系统通知: "info",
  导入完成: "success",
  导入中: "warning",
  正在处理: "warning",
  可显示: "success",
  转换失败: "danger",
  草稿: "warning",
  已发布: "success",
  已归档: "neutral",
  active: "success",
  inactive: "neutral",
  published: "success",
  draft: "warning",
  archived: "neutral",
  ready: "success",
  processing: "warning",
  disabled: "neutral",
  alarm: "danger",
  fault: "warning",
  offline: "neutral",
  normal: "success",
  sent: "success",
  failed: "danger",
  queued: "warning",
  success: "success",
  error: "danger",
  info: "info",
  warn: "warning",
  warning: "warning",
};

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string;
  tone?: BadgeTone;
  className?: string;
}) {
  const displayStatus = normalizeLegacyStatusText(status);
  const resolvedTone = tone ?? statusToneMap[displayStatus] ?? statusToneMap[status] ?? "neutral";

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em]",
        toneClassMap[resolvedTone],
        className,
      )}
    >
      {displayStatus}
    </span>
  );
}
