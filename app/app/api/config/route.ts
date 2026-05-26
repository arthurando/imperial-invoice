import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getConfig, setConfigDataDir } from '@/lib/config';

export async function GET() {
  return NextResponse.json(getConfig());
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as { dataDir?: unknown }).dataDir !== 'string'
  ) {
    return NextResponse.json({ error: 'dataDir (string) required' }, { status: 400 });
  }
  const raw = (body as { dataDir: string }).dataDir.trim();
  if (raw.length === 0) {
    return NextResponse.json({ error: 'dataDir cannot be empty' }, { status: 400 });
  }

  const abs = path.resolve(raw);

  try {
    const stat = await fs.stat(abs);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: `path is not a directory: ${abs}` },
        { status: 400 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: `path does not exist or is not readable: ${abs}` },
      { status: 400 },
    );
  }

  // Pre-create the expected subfolders so the user's first ingestion is friction-free.
  await fs.mkdir(path.join(abs, 'invoice'), { recursive: true });
  await fs.mkdir(path.join(abs, 'prototype', 'extractions'), { recursive: true });

  setConfigDataDir(abs);

  // Re-render every page since the underlying data set just changed wholesale.
  revalidatePath('/', 'layout');

  return NextResponse.json({ ok: true, ...getConfig() });
}
