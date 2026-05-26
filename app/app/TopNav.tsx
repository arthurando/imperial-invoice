'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/files', label: 'Files', match: (p: string) => p === '/files' || p.startsWith('/files/') },
  { href: '/data', label: 'Data', match: (p: string) => p === '/data' || p.startsWith('/data/') },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-3 py-1.5 rounded font-medium ${
              active
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
