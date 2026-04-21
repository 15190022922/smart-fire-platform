"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { NotificationMessageType, NotificationRule, SystemSettings } from "@/types/platform";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100";

const labelClassName = "text-sm text-[color:var(--text-secondary)]";
const messageTypes: NotificationMessageType[] = ["报警信息", "故障信息"];

export function SettingsManager({ initialSettings }: { initialSettings: SystemSettings }) {
  const [settings, setSettings] = useState<SystemSettings>(initialSettings);
  const [savedAt, setSavedAt] = useState<string>("");

  function updateRule(level: NotificationRule["level"], type: NotificationMessageType) {
    setSettings((current) => ({
      ...current,
      notificationRules: current.notificationRules.map((rule) => {
        if (rule.level !== level) {
          return rule;
        }

        const exists = rule.messageTypes.includes(type);
        return {
          ...rule,
          messageTypes: exists
            ? rule.messageTypes.filter((item) => item !== type)
            : [...rule.messageTypes, type],
        };
      }),
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        subtitle="基础配置、短信通知默认规则和楼层图占位配置统一在此管理，当前保存为前端本地状态。"
        aside={
          savedAt ? (
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              最近保存：{savedAt}
            </div>
          ) : null
        }
      />

      <SectionCard title="基础配置" description="当前为静态演示表单，可直接替换为配置接口返回值。">
        <form className="grid gap-5 lg:grid-cols-2">
          <label className="space-y-2">
            <span className={labelClassName}>项目名称</span>
            <input
              className={inputClassName}
              value={settings.projectName}
              onChange={(event) =>
                setSettings((current) => ({ ...current, projectName: event.target.value }))
              }
            />
          </label>
          <label className="space-y-2">
            <span className={labelClassName}>报警阈值</span>
            <input
              className={inputClassName}
              value={settings.alarmThreshold}
              onChange={(event) =>
                setSettings((current) => ({ ...current, alarmThreshold: event.target.value }))
              }
            />
          </label>
          <label className="space-y-2">
            <span className={labelClassName}>通知开关</span>
            <select
              className={inputClassName}
              value={settings.notificationEnabled ? "开启" : "关闭"}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  notificationEnabled: event.target.value === "开启",
                }))
              }
            >
              <option>开启</option>
              <option>关闭</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className={labelClassName}>地图/楼层图占位配置</span>
            <input
              className={inputClassName}
              value={settings.mapPlaceholder}
              onChange={(event) =>
                setSettings((current) => ({ ...current, mapPlaceholder: event.target.value }))
              }
            />
          </label>
          <label className="space-y-2 lg:col-span-2">
            <span className={labelClassName}>通知说明</span>
            <textarea
              className={`${inputClassName} min-h-28`}
              value={settings.remark}
              onChange={(event) => setSettings((current) => ({ ...current, remark: event.target.value }))}
            />
          </label>
        </form>
      </SectionCard>

      <SectionCard
        title="短信通知默认规则"
        description="不同级别用户默认接收的信息类型可在此配置，实际用户仍可在用户管理页单独调整。"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {settings.notificationRules.map((rule) => (
            <div
              key={rule.level}
              className="rounded-[24px] border border-[color:var(--border)] bg-[var(--surface-muted)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[color:var(--text-primary)]">{rule.level}</h3>
                  <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                    默认短信通知：{rule.smsEnabledByDefault ? "开启" : "关闭"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {messageTypes.map((type) => {
                  const active = rule.messageTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateRule(rule.level, type)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        active
                          ? "border-sky-200 bg-sky-50 text-sky-700"
                          : "border-[color:var(--border)] bg-[var(--surface-strong)] text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => setSavedAt("刚刚")}
            className="rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
          >
            保存配置
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
