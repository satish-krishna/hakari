import { describe, it, expect } from 'vitest';
import { MODELS } from '../src/models';

describe('models', () => {
  it('lists models with unique ids', () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every model a positive input price', () => {
    for (const m of MODELS) {
      expect(m.inputPricePerMillion).toBeGreaterThan(0);
    }
  });

  it('spans both suspected tokenizer families', () => {
    const ids = MODELS.map((m) => m.id);
    expect(ids).toContain('claude-opus-4-8'); // new-family suspect
    expect(ids).toContain('claude-fable-5'); // new-family suspect, higher price
    expect(ids).toContain('claude-sonnet-4-6'); // old-family suspect
    expect(ids).toContain('claude-haiku-4-5'); // old-family suspect
  });
});
