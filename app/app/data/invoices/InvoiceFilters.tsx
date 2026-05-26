'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Props {
  folders: string[];
  months: string[];
  suppliers: string[];
  types: string[];
  locations: string[];
}

export function InvoiceFilters({ folders, months, suppliers, types, locations }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value === '') next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function reset() {
    router.replace(pathname);
  }

  const hasFilter =
    sp.get('folder') ||
    sp.get('month') ||
    sp.get('supplier') ||
    sp.get('type') ||
    sp.get('location') ||
    sp.get('check');

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Select
        label="Folder"
        value={sp.get('folder') ?? ''}
        options={folders}
        renderOption={(f) => (f === '' ? '— unfiled' : f)}
        onChange={(v) => update('folder', v)}
      />
      <Select
        label="Month"
        value={sp.get('month') ?? ''}
        options={months}
        onChange={(v) => update('month', v)}
      />
      <Select
        label="Supplier"
        value={sp.get('supplier') ?? ''}
        options={suppliers}
        onChange={(v) => update('supplier', v)}
      />
      <Select
        label="Type"
        value={sp.get('type') ?? ''}
        options={types}
        onChange={(v) => update('type', v)}
      />
      <Select
        label="Location"
        value={sp.get('location') ?? ''}
        options={locations}
        onChange={(v) => update('location', v)}
      />
      <Select
        label="Status"
        value={sp.get('check') ?? ''}
        options={['ok', 'warn', 'fail']}
        onChange={(v) => update('check', v)}
      />
      {hasFilter && (
        <button
          type="button"
          onClick={reset}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  renderOption,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  renderOption?: (o: string) => string;
}) {
  return (
    <label className="inline-flex items-center gap-1">
      <span className="text-zinc-500 text-xs">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {renderOption ? renderOption(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}
