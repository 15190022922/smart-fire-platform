import { cn } from "@/lib/cn";

export function SectionCard({
  title,
  description,
  extra,
  className,
  children,
}: {
  title: string;
  description?: string;
  extra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "sf-panel sf-rise-in relative overflow-hidden p-3 sm:p-3.5",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(72,106,141,0.16),transparent)]" />
      <div className="mb-2.5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-[0.98rem] font-semibold tracking-[-0.01em] text-[color:var(--text-primary)]">{title}</h3>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-[12px] leading-5 text-[color:var(--text-muted)]">{description}</p>
          ) : null}
        </div>
        {extra ? <div>{extra}</div> : null}
      </div>
      {children}
    </section>
  );
}
