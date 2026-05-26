import { describe, it, expect } from 'vitest';
import Page from './page';
describe('ComparePage', () => {
  it('exports a page', () => {
    expect(typeof Page).toBe('function');
  });
});
