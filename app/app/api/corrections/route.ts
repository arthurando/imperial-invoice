import { NextResponse } from 'next/server';
import { appendCorrection, type Correction } from '@/lib/corrections';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  const body = (await request.json()) as Correction;

  if (
    !body.filename ||
    body.page_number === undefined ||
    !body.source_region ||
    !body.field ||
    body.value_after === undefined
  ) {
    return NextResponse.json(
      { error: 'missing required fields' },
      { status: 400 },
    );
  }

  await appendCorrection({
    ...body,
    corrected_by: body.corrected_by ?? 'user',
  });

  // Invalidate the caches so the viewer picks up the correction immediately.
  revalidatePath('/');
  revalidatePath('/files');
  revalidatePath(`/files/${encodeURIComponent(body.filename)}`);
  revalidatePath('/invoices');
  revalidatePath('/items');

  return NextResponse.json({ ok: true });
}
