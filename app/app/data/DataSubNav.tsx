'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/data', label: 'Overview' },
  { href: '/data/invoices', label: 'Invoices' },
  { href: '/data/items', label: 'Items' },
  { href: '/data/compare', label: 'Compare' },
];

export function DataSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {items.map((it) => {
        const active =
          it.href === '/data' ? pathname === '/data' : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`px-3 py-1 rounded ${
              active
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
