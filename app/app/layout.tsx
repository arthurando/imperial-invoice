import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { getConfig } from '@/lib/config';
import { TopNav } from './TopNav';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Imperial Invoice',
  description: 'Invoice extraction & price-tracking workbench',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cfg = getConfig();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-6">
            <Link href="/" className="font-semibold tracking-tight">
              Imperial <span className="text-zinc-400">Invoice</span>
            </Link>
            <TopNav />
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span
                title={cfg.dataDir}
                className="hidden md:inline font-mono text-zinc-500 max-w-[28rem] truncate"
              >
                {cfg.dataDir}
              </span>
              <Link
                href="/settings"
                className={`px-2.5 py-1 rounded font-medium border ${
                  cfg.source === 'default'
                    ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {cfg.source === 'default' ? '⚙ Set data folder' : '⚙ Settings'}
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
