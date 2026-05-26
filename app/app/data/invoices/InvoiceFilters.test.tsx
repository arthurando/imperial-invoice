import { describe, it, expect } from 'vitest';
import { InvoiceFilters } from './InvoiceFilters';
describe('InvoiceFilters', () => {
  it('exports a component', () => {
    expect(typeof InvoiceFilters).toBe('function');
  });
});
