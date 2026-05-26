'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  filename: string;
  page_number: number;
  source_region: string;
  colCount: number;
}

export function AddLineRow({ filename, page_number, source_region, colCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [lineTotal, setLineTotal] = useState('');
  const [isPending, startTransition] = useTransition();

  function reset() {
    setQty('');
    setUnit('');
    setDescription('');
    setUnitPrice('');
    setLineTotal('');
  }

  function save() {
    const payload = {
      qty: qty === '' ? null : Number(qty),
      unit: unit || null,
      description: description.trim() || 'manual-add',
      unit_price: unitPrice === '' ? null : Number(unitPrice),
      line_total: lineTotal === '' ? null : Number(lineTotal),
    };
    if (!description.trim() && qty === '' && unitPrice === '' && lineTotal === '') {
      setOpen(false);
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
          line_number: null,
          field: 'new_line',
          value_before: null,
          value_after: JSON.stringify(payload),
          reason: 'Manually added by user via viewer',
        }),
      });
      if (res.ok) {
        reset();
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={colCount} className="px-3 py-1.5 text-left bg-zinc-50 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-mono text-blue-700 dark:text-blue-300 hover:underline"
          >
            + Add line manually
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-blue-50/40 dark:bg-blue-950/20">
      <td className="px-3 py-1.5 font-mono text-zinc-400 text-xs">new</td>
      <td className="px-3 py-1.5">
        <input
          autoFocus
          type="number"
          step="1"
          placeholder="qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-16 px-1 py-0 rounded border border-blue-300 bg-white dark:bg-zinc-900 font-mono text-xs"
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="text"
          placeholder="unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="w-16 px-1 py-0 rounded border border-blue-300 bg-white dark:bg-zinc-900 font-mono text-xs"
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="text"
          placeholder="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-1 py-0 rounded border border-blue-300 bg-white dark:bg-zinc-900 text-xs"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <input
          type="number"
          step="0.01"
          placeholder="unit $"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          className="w-20 px-1 py-0 rounded border border-blue-300 bg-white dark:bg-zinc-900 font-mono text-xs text-right"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <input
          type="number"
          step="0.01"
          placeholder="line $"
          value={lineTotal}
          onChange={(e) => setLineTotal(e.target.value)}
          className="w-20 px-1 py-0 rounded border border-blue-300 bg-white dark:bg-zinc-900 font-mono text-xs text-right"
        />
      </td>
      <td className="px-3 py-1.5 text-center">
        <div className="inline-flex gap-1">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="text-xs px-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            title="Save (line_total auto-computed if blank)"
          >
            {isPending ? '…' : '✓'}
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="text-xs px-1 rounded bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
          >
            ✗
          </button>
        </div>
      </td>
    </tr>
  );
}
