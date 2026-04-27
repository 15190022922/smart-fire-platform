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
    <section className="sf-panel sf-rise-in relative overflow-hidden p-3 sm:p-3.5">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(72,106,141,0.22),transparent)]" />
      <div className="flex flex-col gap-2.5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end xl:gap-4">
        <div className="max-w-3xl">
          <h2 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-[1.55rem]">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[color:var(--text-muted)] sm:text-[13px]">{subtitle}</p>
        </div>
        {aside ? <div className="xl:min-w-fit xl:max-w-none xl:justify-self-end">{aside}</div> : null}
      </div>
    </section>
  );
}
