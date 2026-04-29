"use client";

import { useEffect, useRef, useState } from "react";

type ThemePreference = "black" | "blue" | "white";

type ThemeOption = {
  id: ThemePreference;
  label: string;
  swatches: string[];
};

const themeOptions: ThemeOption[] = [
  {
    id: "black",
    label: "深色-黑",
    swatches: ["#020202", "#101012", "#d7d7dc"],
  },
  {
    id: "blue",
    label: "深色-蓝黑",
    swatches: ["#05080d", "#121b28", "#78aee7"],
  },
  {
    id: "white",
    label: "浅色-白",
    swatches: ["#eef3f8", "#ffffff", "#486a8d"],
  },
];

function normalizeStoredTheme(value: string | null): ThemePreference {
  if (value === "blue") return "blue";
  if (value === "white" || value === "mist") return "white";
  return "black";
}

export function ThemeSwitcher() {
  const [themePreference, setThemePreference] = useState<ThemePreference>("black");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextPreference = normalizeStoredTheme(window.localStorage.getItem("smart-fire-theme"));
    setThemePreference(nextPreference);
    document.documentElement.dataset.theme = nextPreference;
    window.localStorage.setItem("smart-fire-theme", nextPreference);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themePreference;
    window.localStorage.setItem("smart-fire-theme", themePreference);
  }, [themePreference]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  function applyTheme(themeId: ThemePreference) {
    setThemePreference(themeId);
    setOpen(false);
  }

  const activeOption = themeOptions.find((theme) => theme.id === themePreference) ?? themeOptions[0];

  return (
    <div ref={rootRef} className="relative z-[90]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="sf-button sf-button-secondary h-9 min-w-9 px-0 text-sm shadow-sm"
        aria-label="主题选择"
        title="主题选择"
      >
        <span className="flex gap-0.5">
          {activeOption.swatches.map((swatch) => (
            <span
              key={swatch}
              className="h-2.5 w-2.5 rounded-full border border-white/50 shadow-sm"
              style={{ backgroundColor: swatch }}
            />
          ))}
        </span>
      </button>

      {open ? (
        <div className="sf-fade-in absolute right-0 top-11 z-[120] w-56 rounded-[18px] border border-[color:var(--border)] bg-[var(--surface-strong)] p-2.5 shadow-[var(--panel-shadow-strong)]">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-faint)]">
            Theme
          </p>
          <div className="space-y-1">
            {themeOptions.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => applyTheme(theme.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-[12px] px-2.5 py-2.5 text-sm transition ${
                  themePreference === theme.id
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
                    : "text-[color:var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <span className="min-w-0 flex-1 text-left">{theme.label}</span>
                <span className="flex shrink-0 gap-1">
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
