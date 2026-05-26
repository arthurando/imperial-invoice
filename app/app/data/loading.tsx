export default function DataLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-pulse">
      <header className="flex items-end justify-between">
        <div>
          <div className="h-7 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-4 w-72 bg-zinc-200 dark:bg-zinc-800 rounded mt-2" />
        </div>
        <div className="text-right space-y-1.5">
          <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-7 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-7 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
        ))}
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2"
          >
            <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
            ))}
          </div>
        ))}
      </section>

      <p className="sr-only">Aggregating your invoice data…</p>
    </div>
  );
}
