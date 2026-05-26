import { describe, it, expect } from 'vitest';
import { loadAllFiles, loadFileByFilename } from './invoices';

describe('invoices loader', () => {
  it('loads all extraction JSON files from prototype/extractions', async () => {
    const files = await loadAllFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.filename).toMatch(/\.pdf$/i);
      expect(Array.isArray(f.invoices)).toBe(true);
    }
  });

  it('attaches a checksum to every invoice', async () => {
    const files = await loadAllFiles();
    for (const f of files) {
      for (const inv of f.invoices) {
        expect(inv.check).toBeDefined();
        expect(['ok', 'warn', 'fail']).toContain(inv.check.status);
      }
    }
  });

  it('looks up a single file by filename', async () => {
    const all = await loadAllFiles();
    if (all.length === 0) return;
    const first = all[0];
    const found = await loadFileByFilename(first.filename);
    expect(found?.filename).toBe(first.filename);
  });
});
