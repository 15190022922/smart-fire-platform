"use client";

import { useEffect, useRef, useState } from "react";

type ThemePreference = "system" | "light" | "dark" | "warm" | "mist";
type ResolvedTheme = Exclude<ThemePreference, "system">;

type ThemeOption = {
  id: ThemePreference;
  label: string;
  swatches: string[];
};

const themeOptions: ThemeOption[] = [
  {
    id: "system",
    label: "跟随系统",
    swatches: ["#eef3f8", "#0c1422", "#7ea5cf"],
  },
  {
    id: "light",
    label: "浅色控制台",
    swatches: ["#eef3f8", "#ffffff", "#486a8d"],
  },
  {
    id: "dark",
    label: "夜间值守",
    swatches: ["#0c1422", "#162334", "#7ea5cf"],
  },
  {
    id: "warm",
    label: "暖砂工业",
    swatches: ["#f3ede3", "#fffaf3", "#7c5d41"],
  },
  {
    id: "mist",
    label: "青雾巡检",
    swatches: ["#edf6f5", "#fbfefe", "#487d79"],
  },
];

export function ThemeSwitcher() {
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("smart-fire-theme") as ThemePreference | null;
    const nextPreference = stored ?? "system";
    setThemePreference(nextPreference);
  }, []);

  useEffect(() => {
    function resolveTheme(preference: ThemePreference): ResolvedTheme {
      if (preference === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }

      return preference;
    }

    const nextResolvedTheme = resolveTheme(themePreference);
    setResolvedTheme(nextResolvedTheme);
    document.documentElement.dataset.theme = nextResolvedTheme;
    window.localStorage.setItem("smart-fire-theme", themePreference);
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange() {
      if (themePreference === "system") {
        const nextResolvedTheme = mediaQuery.matches ? "dark" : "light";
        setResolvedTheme(nextResolvedTheme);
        document.documentElement.dataset.theme = nextResolvedTheme;
      }
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
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
  const buttonSwatches = (themePreference === "system"
    ? themeOptions.find((theme) => theme.id === resolvedTheme)?.swatches
    : activeOption.swatches) ?? activeOption.swatches;

  return (
    <div ref={rootRef} className="relative z-[90]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="sf-button sf-button-secondary h-9 min-w-9 px-0 text-sm shadow-sm"
        aria-label="Theme"
        title="主题选择"
      >
        <span className="flex gap-0.5">
          {buttonSwatches.slice(0, 3).map((swatch) => (
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
