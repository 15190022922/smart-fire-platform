import { StatusBadge } from "@/components/status-badge";
import { AlarmRecord } from "@/types/platform";

export function AlarmRealtimePanel({ alarms }: { alarms: AlarmRecord[] }) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-[22px] border border-[color:var(--border-strong)] bg-[var(--surface)] shadow-[var(--panel-shadow)]">
      <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">实时报警</h2>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">最新事件流</p>
        </div>
        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700">
          {alarms.length} 条
        </span>
      </div>

      <div className="min-h-0 space-y-2 overflow-y-auto px-3 py-3 pb-4">
        {alarms.map((alarm) => (
          <article
            key={alarm.id}
            className={`rounded-xl border px-3 py-2.5 ${
              alarm.processStatus === "未处理"
                ? "border-rose-200 bg-rose-50/70"
                : "border-[color:var(--field-border)] bg-[var(--table-row-alt)]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{alarm.deviceName}</p>
                <p className="mt-1 truncate text-[11px] text-[color:var(--text-secondary)]">{alarm.location}</p>
              </div>
              <StatusBadge status={alarm.processStatus} />
            </div>
            <div className="mt-2 grid gap-1 text-[11px] text-[color:var(--text-secondary)]">
              <div className="flex items-center justify-between gap-2">
                <span>时间</span>
                <span className="font-semibold text-[color:var(--text-primary)]">{alarm.time}</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span>类型</span>
                <span className="max-w-[140px] text-right font-medium text-[color:var(--text-primary)]">{alarm.alarmType}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
