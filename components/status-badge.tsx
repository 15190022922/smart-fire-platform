const badgeStyles: Record<string, string> = {
  正常: "border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  在线: "border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  启用: "border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  报警: "border-[rgba(176,72,79,0.18)] bg-[var(--danger-soft)] text-[var(--danger-strong)]",
  未处理: "border-[rgba(176,72,79,0.18)] bg-[var(--danger-soft)] text-[var(--danger-strong)]",
  故障: "border-[rgba(169,107,34,0.2)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
  处理中: "border-[rgba(169,107,34,0.2)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
  离线: "border-[rgba(107,125,145,0.18)] bg-[var(--neutral-soft)] text-[color:var(--text-secondary)]",
  维修中: "border-[rgba(58,100,141,0.18)] bg-[var(--info-soft)] text-[var(--accent-strong)]",
  停用: "border-[rgba(107,125,145,0.18)] bg-[var(--neutral-soft)] text-[color:var(--text-secondary)]",
  已处理: "border-[rgba(72,106,141,0.18)] bg-[var(--info-soft)] text-[var(--accent-strong)]",
  已确认: "border-[rgba(72,106,141,0.18)] bg-[var(--info-soft)] text-[var(--accent-strong)]",
  已完成: "border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  已关闭: "border-[rgba(107,125,145,0.18)] bg-[var(--neutral-soft)] text-[color:var(--text-secondary)]",

  "姝ｅ父": "border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  "鍦ㄧ嚎": "border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  "鍚敤": "border-[rgba(57,118,91,0.16)] bg-[var(--success-soft)] text-[var(--success-strong)]",
  "鎶ヨ": "border-[rgba(176,72,79,0.18)] bg-[var(--danger-soft)] text-[var(--danger-strong)]",
  "鏈鐞?": "border-[rgba(176,72,79,0.18)] bg-[var(--danger-soft)] text-[var(--danger-strong)]",
  "鏁呴殰": "border-[rgba(169,107,34,0.2)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
  "澶勭悊涓?": "border-[rgba(169,107,34,0.2)] bg-[var(--warning-soft)] text-[var(--warning-strong)]",
  "绂荤嚎": "border-[rgba(107,125,145,0.18)] bg-[var(--neutral-soft)] text-[color:var(--text-secondary)]",
  "缁翠慨涓?": "border-[rgba(58,100,141,0.18)] bg-[var(--info-soft)] text-[var(--accent-strong)]",
  "鍋滅敤": "border-[rgba(107,125,145,0.18)] bg-[var(--neutral-soft)] text-[color:var(--text-secondary)]",
  "宸插鐞?": "border-[rgba(72,106,141,0.18)] bg-[var(--info-soft)] text-[var(--accent-strong)]",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em] ${
        badgeStyles[status] ??
        "border-[color:var(--border)] bg-[var(--surface-muted)] text-[color:var(--text-secondary)]"
      }`}
    >
      {status}
    </span>
  );
}
