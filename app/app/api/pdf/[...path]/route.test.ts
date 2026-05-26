import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { GET } from './route';

describe('GET /api/pdf/[...path]', () => {
  let tempRoot: string;
  let prevEnv: string | undefined;

  beforeAll(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'imperial-pdf-test-'));
    await fs.mkdir(path.join(tempRoot, 'invoice', 'June 2025'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, 'invoice', 'June 2025', 'Tofu.pdf'),
      'fake-pdf-bytes',
    );
    await fs.writeFile(
      path.join(tempRoot, 'invoice', 'flat.pdf'),
      'flat-bytes',
    );
    prevEnv = process.env.IMPERIAL_DATA_DIR;
    process.env.IMPERIAL_DATA_DIR = tempRoot;
  });

  afterAll(async () => {
    process.env.IMPERIAL_DATA_DIR = prevEnv;
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const callGET = async (segments: string[]) =>
    GET(new Request('http://x/'), { params: Promise.resolve({ path: segments }) });

  it('streams a PDF from a subfolder', async () => {
    const res = await callGET(['June 2025', 'Tofu.pdf'].map(encodeURIComponent));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    const buf = await res.arrayBuffer();
    expect(Buffer.from(buf).toString()).toBe('fake-pdf-bytes');
  });

  it('streams a PDF from the invoice root (legacy flat)', async () => {
    const res = await callGET(['flat.pdf']);
    expect(res.status).toBe(200);
  });

  it('404s on missing file', async () => {
    const res = await callGET(['June 2025', 'nope.pdf'].map(encodeURIComponent));
    expect(res.status).toBe(404);
  });

  it('rejects path traversal via ..', async () => {
    const res = await callGET(['..', 'secrets.pdf']);
    expect(res.status).toBe(403);
  });

  it('rejects non-pdf extensions', async () => {
    const res = await callGET(['evil.exe']);
    expect(res.status).toBe(400);
  });

  it('rejects empty path', async () => {
    const res = await GET(new Request('http://x/'), {
      params: Promise.resolve({ path: [] }),
    });
    expect(res.status).toBe(400);
  });
});
