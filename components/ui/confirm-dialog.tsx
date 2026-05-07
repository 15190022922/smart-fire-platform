"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Dialog } from "@/components/ui/dialog";

export type ConfirmDialogResult = "confirm" | "extra" | "cancel";

type ConfirmDialogInput = {
  title: string;
  description?: string;
  detail?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  extraLabel?: string;
  tone?: "default" | "danger" | "warning";
};

type ConfirmDialogContextValue = {
  confirmDialog: (input: ConfirmDialogInput) => Promise<ConfirmDialogResult>;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<ConfirmDialogInput | null>(null);
  const resolverRef = useRef<((result: ConfirmDialogResult) => void) | null>(null);

  const close = useCallback((result: ConfirmDialogResult) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const confirmDialog = useCallback(
    (input: ConfirmDialogInput) =>
      new Promise<ConfirmDialogResult>((resolve) => {
        resolverRef.current?.("cancel");
        resolverRef.current = resolve;
        setDialog(input);
      }),
    [],
  );

  const value = useMemo(() => ({ confirmDialog }), [confirmDialog]);
  const confirmVariant = dialog?.tone === "danger" ? "danger" : dialog?.tone === "warning" ? "warning" : "primary";

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <Dialog
        open={!!dialog}
        onClose={() => close("cancel")}
        title={dialog?.title ?? "请确认"}
        eyebrow="操作确认"
        description={dialog?.description}
        panelClassName="max-w-lg"
        footer={
          <>
            <ActionButton onClick={() => close("cancel")}>{dialog?.cancelLabel ?? "取消"}</ActionButton>
            {dialog?.extraLabel ? (
              <ActionButton variant="warning" onClick={() => close("extra")}>
                {dialog.extraLabel}
              </ActionButton>
            ) : null}
            <ActionButton variant={confirmVariant} onClick={() => close("confirm")}>
              {dialog?.confirmLabel ?? "确定"}
            </ActionButton>
          </>
        }
      >
        {dialog?.detail ? <div className="text-sm leading-6 text-[color:var(--text-secondary)]">{dialog.detail}</div> : null}
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }
  return context;
}
