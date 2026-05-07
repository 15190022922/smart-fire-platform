export function Dialog({
  open,
  title,
  eyebrow = "Detail Panel",
  description,
  onClose,
  children,
  footer,
  panelClassName = "max-w-2xl",
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  panelClassName?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="sf-fade-in fixed inset-0 z-[180] flex items-start justify-center overflow-y-auto bg-[var(--dialog-overlay)] px-4 py-6 backdrop-blur-sm sm:items-center sm:py-8">
      <div className={`sf-rise-in flex max-h-[calc(100vh-3rem)] w-full ${panelClassName} flex-col overflow-hidden rounded-[var(--radius-dialog)] border border-[color:var(--border)] bg-[var(--surface-strong)] shadow-[var(--panel-shadow-strong)]`}>
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] bg-[var(--panel-header-bg)] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-faint)]">
              {eyebrow}
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
        <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-3 border-t border-[color:var(--border)] bg-[var(--panel-body-bg)] px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
