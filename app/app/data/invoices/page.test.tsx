import { describe, it, expect } from 'vitest';
import Page from './page';
describe('InvoicesPage', () => {
  it('exports a page', () => {
    expect(typeof Page).toBe('function');
  });
});
