"use client";

import { useEffect, useRef, useState } from "react";

type ThemeOption = {
  id: string;
  label: string;
  swatches: string[];
};

const themeOptions: ThemeOption[] = [
  {
    id: "light",
    label: "浅色控制台",
    swatches: ["#f3f6fa", "#ffffff", "#0f172a"],
  },
  {
    id: "dark",
    label: "深色值守",
    swatches: ["#0f172a", "#1e293b", "#22d3ee"],
  },
  {
    id: "warm",
    label: "暖沙工业",
    swatches: ["#f7f1e8", "#d97706", "#78350f"],
  },
  {
    id: "mist",
    label: "青雾巡检",
    swatches: ["#edf4f4", "#14b8a6", "#16323a"],
  },
];

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.localStorage.getItem("smart-fire-theme") ?? "light";
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    window.localStorage.setItem("smart-fire-theme", activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  function applyTheme(themeId: string) {
    setActiveTheme(themeId);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[var(--surface)] text-[color:var(--text-secondary)] shadow-sm transition hover:bg-[var(--surface-muted)]"
        aria-label="主题选择"
        title="主题选择"
      >
        <span className="text-base">◐</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-52 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-strong)] p-2.5 shadow-[var(--panel-shadow)]">
          <p className="px-2 pb-2 text-xs font-medium text-[color:var(--text-muted)]">主题选择</p>
          <div className="space-y-1">
            {themeOptions.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => applyTheme(theme.id)}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm transition ${
                  activeTheme === theme.id
                    ? "bg-sky-50 text-sky-700"
                    : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <span>{theme.label}</span>
                <span className="flex gap-1">
                  {theme.swatches.map((swatch) => (
                    <span
                      key={swatch}
                      className="h-3 w-3 rounded-full border border-white/60 shadow-sm"
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
