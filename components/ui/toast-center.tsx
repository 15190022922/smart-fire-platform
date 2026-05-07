"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "info" | "success" | "warning" | "error";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  duration: number;
};

type ToastInput = {
  message: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastContextValue = {
  pushToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toneClassName(tone: ToastTone) {
  if (tone === "success") {
    return "border-[color:var(--border-soft)] bg-[color:var(--success-soft)] text-[color:var(--success-strong)]";
  }
  if (tone === "warning") {
    return "border-[color:var(--border-soft)] bg-[color:var(--warning-soft)] text-[color:var(--warning-strong)]";
  }
  if (tone === "error") {
    return "border-[color:var(--border-soft)] bg-[color:var(--danger-soft)] text-[color:var(--danger-strong)]";
  }
  return "border-[color:var(--border-soft)] bg-[color:var(--info-soft)] text-[color:var(--accent-strong)]";
}

function ToastCard({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClose(toast.id)}
      className={`sf-toast-in pointer-events-auto w-[min(92vw,460px)] rounded-[18px] border px-4 py-3 text-center text-sm font-medium shadow-[var(--panel-shadow-strong)] backdrop-blur ${toneClassName(toast.tone)}`}
    >
      {toast.message}
    </button>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ message, tone = "info", duration = 2600 }: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { id, message, tone, duration }].slice(-5));
      window.setTimeout(() => removeToast(id), duration);
    },
    [removeToast],
  );

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-[160] flex flex-col-reverse items-center gap-2 px-4">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}
