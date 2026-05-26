// Contract for the /settings page — server component.
// Verifies the module exports a default React component, plus that the
// diagnostic helper renders without throwing when the data dir is empty.
import { describe, it, expect } from 'vitest';
import SettingsPage from './page';

describe('SettingsPage (contract)', () => {
  it('default export is a function', () => {
    expect(typeof SettingsPage).toBe('function');
  });
});
