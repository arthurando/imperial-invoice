import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { GET, POST } from './route';

describe('GET /api/config + POST /api/config', () => {
  let tempHome: string;
  let tempData: string;
  let prevHome: string | undefined;
  let prevEnv: string | undefined;

  beforeEach(async () => {
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'imperial-cfg-api-'));
    tempData = await fs.mkdtemp(path.join(os.tmpdir(), 'imperial-data-'));
    prevHome = process.env.HOME ?? process.env.USERPROFILE;
    prevEnv = process.env.IMPERIAL_DATA_DIR;
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
    delete process.env.IMPERIAL_DATA_DIR;
  });

  afterAll(async () => {
    if (prevHome) {
      process.env.HOME = prevHome;
      process.env.USERPROFILE = prevHome;
    }
    if (prevEnv) process.env.IMPERIAL_DATA_DIR = prevEnv;
  });

  it('GET returns the default source when nothing is configured', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe('default');
  });

  it('POST saves a valid data dir and persists it', async () => {
    const res = await POST(
      new Request('http://x/', {
        method: 'POST',
        body: JSON.stringify({ dataDir: tempData }),
      }),
    );
    expect(res.status).toBe(200);
    const after = await GET().then((r) => r.json());
    expect(after.source).toBe('config');
    expect(after.dataDir).toBe(tempData);
  });

  it('POST rejects a non-existent path', async () => {
    const res = await POST(
      new Request('http://x/', {
        method: 'POST',
        body: JSON.stringify({ dataDir: path.join(tempData, 'does-not-exist') }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST rejects a path that is a file, not a directory', async () => {
    const filePath = path.join(tempData, 'file.txt');
    await fs.writeFile(filePath, 'x');
    const res = await POST(
      new Request('http://x/', {
        method: 'POST',
        body: JSON.stringify({ dataDir: filePath }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST rejects an empty string', async () => {
    const res = await POST(
      new Request('http://x/', { method: 'POST', body: JSON.stringify({ dataDir: '' }) }),
    );
    expect(res.status).toBe(400);
  });
});
