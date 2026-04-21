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
    <section className="rounded-[28px] border border-[color:var(--border)] bg-[var(--surface)] p-6 shadow-[var(--panel-shadow)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.34em] text-sky-700">智慧消防平台</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-base">
            {subtitle}
          </p>
        </div>
        {aside ? <div className="xl:max-w-xl">{aside}</div> : null}
      </div>
    </section>
  );
}
