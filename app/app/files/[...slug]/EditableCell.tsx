'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  filename: string;
  page_number: number;
  source_region: string;
  line_number: number | null;
  field: 'unit_price' | 'qty' | 'weight' | 'line_total' | 'invoice_date' | 'total';
  initialValue: number | string | null;
  display?: string;
  align?: 'left' | 'right';
}

export function EditableCell({
  filename,
  page_number,
  source_region,
  line_number,
  field,
  initialValue,
  display,
  align = 'right',
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(
    initialValue === null ? '' : String(initialValue),
  );
  const [isPending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState(false);

  const isNumeric = field !== 'invoice_date';

  function save() {
    const parsed = isNumeric ? Number(value) : value;
    if (isNumeric && (Number.isNaN(parsed) || parsed === '')) {
      setEditing(false);
      setValue(initialValue === null ? '' : String(initialValue));
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename,
          page_number,
          source_region,
          line_number,
          field,
          value_before: initialValue,
          value_after: parsed,
        }),
      });
      if (res.ok) {
        setEditing(false);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
        router.refresh();
      }
    });
  }

  function cancel() {
    setValue(initialValue === null ? '' : String(initialValue));
    setEditing(false);
  }

  if (editing) {
    const dirty = String(initialValue ?? '') !== value;
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          type={isNumeric ? 'number' : 'text'}
          step={field === 'qty' ? '1' : '0.01'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dirty) save();
            if (e.key === 'Escape') cancel();
          }}
          className={`w-20 px-1 py-0 rounded border border-blue-400 bg-white dark:bg-zinc-800 font-mono text-xs ${align === 'right' ? 'text-right' : 'text-left'} focus:outline-none focus:ring-1 focus:ring-blue-500`}
          disabled={isPending}
        />
        <button
          type="button"
          onClick={save}
          disabled={!dirty || isPending}
          title="Save (Enter) — re-runs checksum"
          className="text-xs px-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed"
        >
          {isPending ? '…' : '✓'}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={isPending}
          title="Cancel (Esc)"
          className="text-xs px-1 rounded bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-400 dark:hover:bg-zinc-600"
        >
          ✗
        </button>
      </span>
    );
  }

  const label = display ?? (initialValue === null ? '—' : String(initialValue));

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`inline-block min-w-[3rem] px-1 py-0 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:ring-1 hover:ring-blue-300 cursor-text ${align === 'right' ? 'text-right' : 'text-left'} ${savedFlash ? 'bg-emerald-100 dark:bg-emerald-900/40' : ''}`}
      title="Click to edit"
    >
      {label}
    </button>
  );
}
