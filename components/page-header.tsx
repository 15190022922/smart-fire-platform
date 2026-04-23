export function PageHeader({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[color:var(--border)] bg-[var(--surface)] p-4 shadow-[var(--panel-shadow)] sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-[2rem]">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[color:var(--text-muted)] sm:text-sm">{subtitle}</p>
        </div>
        {aside ? <div className="xl:max-w-xl">{aside}</div> : null}
      </div>
    </section>
  );
}
