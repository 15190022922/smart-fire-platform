export const THEME_COOKIE_NAME = "smart-fire-theme";
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const THEME_PREFERENCES = ["black", "blue", "white"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "black";

export function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === "blue") return "blue";
  if (value === "white" || value === "mist") return "white";
  return DEFAULT_THEME_PREFERENCE;
}

export function serializeThemeCookie(theme: ThemePreference) {
  return `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function getThemeBootstrapScript() {
  return `
(() => {
  try {
    var cookieName = ${JSON.stringify(THEME_COOKIE_NAME)};
    var maxAge = ${THEME_COOKIE_MAX_AGE_SECONDS};
    var theme = null;

    try {
      theme = window.localStorage.getItem(cookieName);
    } catch (_) {}

    if (theme === "mist") {
      theme = "white";
    }

    if (theme !== "black" && theme !== "blue" && theme !== "white") {
      var match = document.cookie.match(new RegExp("(?:^|; )" + cookieName + "=([^;]*)"));
      theme = match ? decodeURIComponent(match[1]) : null;

      if (theme === "mist") {
        theme = "white";
      }
    }

    if (theme !== "blue" && theme !== "white") {
      theme = "black";
    }

    if (document.documentElement.dataset.theme !== theme) {
      document.documentElement.dataset.theme = theme;
    }

    try {
      window.localStorage.setItem(cookieName, theme);
    } catch (_) {}

    document.cookie = cookieName + "=" + encodeURIComponent(theme) + "; Path=/; Max-Age=" + maxAge + "; SameSite=Lax";
  } catch (_) {}
})();
`;
}
