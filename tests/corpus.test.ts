import { describe, it, expect } from 'vitest';
import { SAMPLES } from '../src/corpus';
import type { Category } from '../src/types';

const CATEGORIES: Category[] = ['english', 'code', 'json', 'non-english'];

describe('corpus', () => {
  it('has samples in every category', () => {
    for (const cat of CATEGORIES) {
      expect(SAMPLES.some((s) => s.category === cat)).toBe(true);
    }
  });

  it('has unique, non-empty ids and text', () => {
    const ids = new Set<string>();
    for (const s of SAMPLES) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
    }
  });

  it('only uses known categories', () => {
    for (const s of SAMPLES) {
      expect(CATEGORIES).toContain(s.category);
    }
  });
});
