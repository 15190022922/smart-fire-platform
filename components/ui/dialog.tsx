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
    <div className="sf-fade-in fixed inset-0 z-50 flex items-center justify-center bg-[var(--dialog-overlay)] p-4 backdrop-blur-sm">
      <div className="sf-rise-in w-full max-w-2xl overflow-hidden rounded-[var(--radius-dialog)] border border-[color:var(--border)] bg-[var(--surface-strong)] shadow-[0_22px_64px_rgba(11,21,34,0.16)]">
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(250,252,255,0.96)_0%,rgba(244,248,252,0.96)_100%)] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-faint)]">
              Detail Panel
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">{title}</h3>
            {description ? <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sf-button sf-button-secondary px-3 py-1.5 text-sm"
          >
            关闭
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-3 border-t border-[color:var(--border)] bg-[rgba(245,248,252,0.65)] px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
