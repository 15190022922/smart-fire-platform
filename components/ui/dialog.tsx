export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dialog-overlay)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-[color:var(--border)] bg-[var(--surface-strong)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{title}</h3>
            {description ? <p className="mt-2 text-sm text-[color:var(--text-muted)]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-sm text-[color:var(--text-secondary)] transition hover:bg-[var(--surface-muted)]"
          >
            关闭
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-3 border-t border-[color:var(--border)] px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
