export default function FilesLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 animate-pulse">
      <header>
        <div className="h-7 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded mt-2" />
      </header>

      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-7 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-4 space-y-2">
        <div className="h-5 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>

      {[1, 2, 3].map((g) => (
        <section key={g} className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-zinc-200 dark:border-zinc-800 pb-1">
            <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <li
                key={i}
                className="h-16 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              />
            ))}
          </ul>
        </section>
      ))}

      <p className="sr-only">Scanning your data folder…</p>
    </div>
  );
}
