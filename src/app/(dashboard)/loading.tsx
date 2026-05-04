function LoadingCard() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-8 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <section className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-border bg-surface/70 p-4">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="h-3 w-72 max-w-full animate-pulse rounded bg-muted" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <LoadingCard key={index} />
        ))}
      </div>
    </section>
  );
}
