import { describe, it, expect } from 'vitest';
import Page from './page';

describe('DashboardPage', () => {
  it('exports a default page component', () => {
    expect(typeof Page).toBe('function');
  });
});
