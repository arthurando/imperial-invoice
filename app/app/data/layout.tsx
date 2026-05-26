import Link from 'next/link';
import { DataSubNav } from './DataSubNav';

export default function DataLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 min-h-full">
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-2">
          <DataSubNav />
        </div>
      </div>
      {children}
    </div>
  );
}
