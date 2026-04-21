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
        "rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] p-5 shadow-[var(--panel-shadow)] sm:p-6",
        className,
      )}
    >
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{title}</h3>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">{description}</p>
          ) : null}
        </div>
        {extra ? <div>{extra}</div> : null}
      </div>
      {children}
    </section>
  );
}
