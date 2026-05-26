import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { invoiceDir } from '@/lib/config';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: rawSegments } = await params;
  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    return new NextResponse('bad request', { status: 400 });
  }

  const decoded = rawSegments.map((s) => decodeURIComponent(s));

  for (const seg of decoded) {
    if (!seg || seg === '..' || seg.includes('\0')) {
      return new NextResponse('forbidden', { status: 403 });
    }
    if (path.isAbsolute(seg)) {
      return new NextResponse('forbidden', { status: 403 });
    }
  }
  const filename = decoded[decoded.length - 1];
  if (!filename.toLowerCase().endsWith('.pdf')) {
    return new NextResponse('not a pdf', { status: 400 });
  }

  const root = invoiceDir();
  const target = path.join(root, ...decoded);
  const resolved = path.resolve(target);
  const resolvedRoot = path.resolve(root);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    return new NextResponse('forbidden', { status: 403 });
  }

  let data: Buffer;
  try {
    data = await fs.readFile(resolved);
  } catch {
    return new NextResponse('not found', { status: 404 });
  }

  const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(data.byteLength),
      'cache-control': 'private, max-age=3600',
    },
  });
}
