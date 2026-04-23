"use client";

import { useEffect, useState } from "react";

const spacingOptions = [
  { label: "极窄 4", topOffset: 4, gap: 4, mainTop: 4 },
  { label: "紧凑 8", topOffset: 8, gap: 12, mainTop: 10 },
  { label: "紧凑 12", topOffset: 12, gap: 14, mainTop: 12 },
  { label: "标准 16", topOffset: 16, gap: 16, mainTop: 12 },
  { label: "宽松 20", topOffset: 20, gap: 18, mainTop: 14 },
  { label: "宽松 24", topOffset: 24, gap: 20, mainTop: 16 },
  { label: "宽松 28", topOffset: 28, gap: 22, mainTop: 18 },
] as const;

const STORAGE_KEY = "tenant-spacing-option";

function applySpacing(option: (typeof spacingOptions)[number]) {
  document.documentElement.style.setProperty("--tenant-page-top-offset", `${option.topOffset}px`);
  document.documentElement.style.setProperty("--tenant-page-gap", `${option.gap}px`);
  document.documentElement.style.setProperty("--tenant-main-padding-top", `${option.mainTop}px`);
}

export function TenantSpacingSelector() {
  const [selectedLabel, setSelectedLabel] = useState<(typeof spacingOptions)[number]["label"]>(() => {
    if (typeof window === "undefined") {
      return "极窄 4";
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    return spacingOptions.find((item) => item.label === saved)?.label ?? "极窄 4";
  });

  useEffect(() => {
    const option = spacingOptions.find((item) => item.label === selectedLabel) ?? spacingOptions[0];
    applySpacing(option);
  }, [selectedLabel]);

  function handleChange(value: string) {
    const option = spacingOptions.find((item) => item.label === value) ?? spacingOptions[2];
    setSelectedLabel(option.label);
    applySpacing(option);
    window.localStorage.setItem(STORAGE_KEY, option.label);
  }

  return (
    <label className="hidden items-center gap-2 rounded-full border border-[color:var(--border)] bg-[var(--surface-strong)] px-3 py-1.5 md:inline-flex">
      <span className="text-xs text-[color:var(--text-muted)]">边距</span>
      <select
        value={selectedLabel}
        onChange={(event) => handleChange(event.target.value)}
        className="bg-transparent text-xs text-[color:var(--text-primary)] outline-none"
      >
        {spacingOptions.map((option) => (
          <option key={option.label} value={option.label}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
