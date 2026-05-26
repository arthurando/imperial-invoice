// Contract for DataDirForm — a client component that lets the user replace
// the active data directory by POSTing { dataDir } to /api/config and then
// refreshing the route.
//
// Behavioural expectations (DOM-light contract; real assertions require
// @testing-library/react which isn't wired up yet, so these tests stay as
// documentation until the runner lands):
//
//   - Renders an <input> seeded with `currentDataDir`.
//   - Save button is disabled when the input value equals currentDataDir.
//   - On click, POSTs the trimmed value to /api/config, calls router.refresh()
//     on 2xx, surfaces the JSON `error` field on 4xx/5xx.
//
import { describe, it, expect } from 'vitest';
import { DataDirForm } from './DataDirForm';

describe('DataDirForm (contract)', () => {
  it('is importable', () => {
    expect(typeof DataDirForm).toBe('function');
  });
});
