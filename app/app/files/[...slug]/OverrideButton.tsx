'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  filename: string;
  page_number: number;
  source_region: string;
  currentStatus: 'ok' | 'warn' | 'fail' | 'ok-manual';
}

export function OverrideButton({
  filename,
  page_number,
  source_region,
  currentStatus,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isOverridden = currentStatus === 'ok-manual';

  function override() {
    startTransition(async () => {
      await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename,
          page_number,
          source_region,
          line_number: null,
          field: 'status_override',
          value_before: currentStatus,
          value_after: isOverridden ? null : 'ok-manual',
        }),
      });
      router.refresh();
    });
  }

  if (isOverridden) {
    return (
      <button
        type="button"
        onClick={override}
        disabled={isPending}
        title="Undo manual OK — revert to checksum result"
        className="text-xs font-mono px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 disabled:opacity-50"
      >
        {isPending ? '…' : 'Undo OK-manual'}
      </button>
    );
  }

  if (currentStatus === 'ok') return null;

  return (
    <button
      type="button"
      onClick={override}
      disabled={isPending}
      title="Mark as reviewed and OK — overrides the checksum failure"
      className="text-xs font-mono px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {isPending ? '…' : 'Mark OK (manual)'}
    </button>
  );
}
