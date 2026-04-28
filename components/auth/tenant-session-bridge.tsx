"use client";

import { useEffect } from "react";

const STORAGE_KEY = "smart-fire-tenant-session-token";

function shouldAttachTenantSession(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  if (url.startsWith("/api/tenant/")) return true;
  if (url.startsWith(`${window.location.origin}/api/tenant/`)) return true;
  return false;
}

export function getPinnedTenantSessionToken() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(STORAGE_KEY) ?? "";
}

export function TenantSessionBridge({ token }: { token: string }) {
  useEffect(() => {
    if (!token) return;
    window.sessionStorage.setItem(STORAGE_KEY, token);
  }, [token]);

  useEffect(() => {
    if ((window as typeof window & { __smartFireFetchPatched?: boolean }).__smartFireFetchPatched) {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const pinnedToken = getPinnedTenantSessionToken();
      if (!pinnedToken || !shouldAttachTenantSession(input)) {
        return originalFetch(input, init);
      }

      const headers = new Headers(init.headers);
      headers.set("x-smart-fire-session", pinnedToken);
      return originalFetch(input, { ...init, headers });
    };

    (window as typeof window & { __smartFireFetchPatched?: boolean }).__smartFireFetchPatched = true;
  }, []);

  return null;
}
