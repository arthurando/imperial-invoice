import { describe, it, expect } from 'vitest';
import Layout, { metadata } from './layout';

describe('RootLayout', () => {
  it('exports a layout component', () => {
    expect(typeof Layout).toBe('function');
  });
  it('exposes metadata title', () => {
    expect(metadata.title).toBe('Imperial Invoice');
  });
});
