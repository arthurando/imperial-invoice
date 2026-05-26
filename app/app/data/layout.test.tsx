import { describe, it, expect } from 'vitest';
import DataLayout from './layout';

describe('DataLayout (contract)', () => {
  it('default export is a function', () => {
    expect(typeof DataLayout).toBe('function');
  });
});
