import { describe, it, expect } from 'vitest';
import { EditableCell } from './EditableCell';
describe('EditableCell', () => {
  it('exports a component', () => {
    expect(typeof EditableCell).toBe('function');
  });
});
