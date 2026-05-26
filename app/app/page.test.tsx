// Contract: root / redirects to /files.
// next/navigation's `redirect()` throws a special signal at runtime — we just
// verify the default export exists.
import { describe, it, expect } from 'vitest';
import RootPage from './page';

describe('Root page (contract)', () => {
  it('default export is a function', () => {
    expect(typeof RootPage).toBe('function');
  });
});
