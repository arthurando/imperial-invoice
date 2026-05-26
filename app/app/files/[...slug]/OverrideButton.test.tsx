import { describe, it, expect } from 'vitest';
import { OverrideButton } from './OverrideButton';
describe('OverrideButton', () => {
  it('exports a component', () => {
    expect(typeof OverrideButton).toBe('function');
  });
});
