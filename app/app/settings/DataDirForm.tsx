'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  currentDataDir: string;
}

export function DataDirForm({ currentDataDir }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(currentDataDir);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function save() {
    setError(null);
    setOkMessage(null);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dataDir: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'request failed' }));
        setError(body.error ?? 'request failed');
        return;
      }
      setOkMessage('Saved. Refreshing…');
      startTransition(() => {
        router.refresh();
        setTimeout(() => setOkMessage(null), 1500);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'request failed');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="C:\Users\you\imperial-data"
          spellCheck={false}
          className="flex-1 px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-sm"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending || value === currentDataDir}
          className="px-4 py-2 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          ⚠ {error}
        </p>
      )}
      {okMessage && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          ✓ {okMessage}
        </p>
      )}
    </div>
  );
}
