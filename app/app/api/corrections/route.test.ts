import { describe, it, expect } from 'vitest';
import { POST } from './route';

describe('corrections route', () => {
  it('exports a POST handler', () => {
    expect(typeof POST).toBe('function');
  });
});
