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
        "rounded-[24px] border border-[color:var(--border)] bg-[var(--surface)] p-4 shadow-[var(--panel-shadow)] sm:p-5",
        className,
      )}
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{title}</h3>
          {description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">{description}</p> : null}
        </div>
        {extra ? <div>{extra}</div> : null}
      </div>
      {children}
    </section>
  );
}
