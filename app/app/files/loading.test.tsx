import { describe, it, expect } from 'vitest';
import Loading from './loading';

describe('files loading skeleton (contract)', () => {
  it('default export is a function', () => {
    expect(typeof Loading).toBe('function');
  });
});
