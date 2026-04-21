const badgeStyles: Record<string, string> = {
  正常: "border-emerald-200 bg-emerald-50 text-emerald-700",
  在线: "border-emerald-200 bg-emerald-50 text-emerald-700",
  启用: "border-emerald-200 bg-emerald-50 text-emerald-700",
  报警: "border-rose-200 bg-rose-50 text-rose-700",
  未处理: "border-rose-200 bg-rose-50 text-rose-700",
  故障: "border-amber-200 bg-amber-50 text-amber-700",
  处理中: "border-amber-200 bg-amber-50 text-amber-700",
  离线: "border-slate-200 bg-slate-100 text-slate-700",
  维修中: "border-cyan-200 bg-cyan-50 text-cyan-700",
  停用: "border-slate-200 bg-slate-100 text-slate-700",
  已处理: "border-sky-200 bg-sky-50 text-sky-700",
  "姝ｅ父": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "鍦ㄧ嚎": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "鍚敤": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "鎶ヨ": "border-rose-200 bg-rose-50 text-rose-700",
  "鏈鐞?": "border-rose-200 bg-rose-50 text-rose-700",
  "鏁呴殰": "border-amber-200 bg-amber-50 text-amber-700",
  "澶勭悊涓?": "border-amber-200 bg-amber-50 text-amber-700",
  "绂荤嚎": "border-slate-200 bg-slate-100 text-slate-700",
  "缁翠慨涓?": "border-cyan-200 bg-cyan-50 text-cyan-700",
  "鍋滅敤": "border-slate-200 bg-slate-100 text-slate-700",
  "宸插鐞?": "border-sky-200 bg-sky-50 text-sky-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
        badgeStyles[status] ??
        "border-[color:var(--border)] bg-[var(--surface-muted)] text-[color:var(--text-secondary)]"
      }`}
    >
      {status}
    </span>
  );
}
