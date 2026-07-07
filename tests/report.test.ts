import { describe, it, expect } from 'vitest';
import { clusterModels, categoryTotals, costTable, toCsv } from '../src/report';
import type { RunResult, Sample, ModelSpec } from '../src/types';

const samples: Sample[] = [
  { id: 's1', category: 'english', text: 'a' },
  { id: 's2', category: 'code', text: 'b' },
];
const models: ModelSpec[] = [
  { id: 'twin-a', inputPricePerMillion: 5 },
  { id: 'twin-b', inputPricePerMillion: 10 },
  { id: 'other', inputPricePerMillion: 1 },
];

// twin-a and twin-b have identical vectors [10, 20]; other has [12, 25].
const result: RunResult = {
  overhead: [],
  measurements: [
    { model: 'twin-a', sampleId: 's1', tokens: 10 },
    { model: 'twin-a', sampleId: 's2', tokens: 20 },
    { model: 'twin-b', sampleId: 's1', tokens: 10 },
    { model: 'twin-b', sampleId: 's2', tokens: 20 },
    { model: 'other', sampleId: 's1', tokens: 12 },
    { model: 'other', sampleId: 's2', tokens: 25 },
  ],
};

describe('clusterModels', () => {
  it('groups models with identical token vectors', () => {
    const clusters = clusterModels(result, models, samples);
    const twinCluster = clusters.find((c) => c.models.includes('twin-a'));
    expect(twinCluster?.models.sort()).toEqual(['twin-a', 'twin-b']);
    const otherCluster = clusters.find((c) => c.models.includes('other'));
    expect(otherCluster?.models).toEqual(['other']);
  });

  it('excludes models with a null measurement', () => {
    const incomplete: RunResult = {
      overhead: [],
      measurements: [
        { model: 'twin-a', sampleId: 's1', tokens: 10 },
        { model: 'twin-a', sampleId: 's2', tokens: null, error: 'x' },
      ],
    };
    const clusters = clusterModels(incomplete, [models[0]], samples);
    expect(clusters).toHaveLength(0);
  });
});

describe('categoryTotals', () => {
  it('sums tokens per category per model', () => {
    const totals = categoryTotals(result, samples, models);
    expect(totals.get('twin-a')?.get('english')).toBe(10);
    expect(totals.get('twin-a')?.get('code')).toBe(20);
    expect(totals.get('other')?.get('english')).toBe(12);
  });
});

describe('costTable', () => {
  it('computes dollars as tokens / 1e6 * price', () => {
    const rows = costTable(result, models);
    const row = rows.find((r) => r.model === 'twin-b' && r.sampleId === 's1');
    expect(row?.dollars).toBeCloseTo((10 / 1_000_000) * 10, 12);
  });
});

describe('toCsv', () => {
  it('emits a header and one row per measurement', () => {
    const csv = toCsv(result);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('model,sampleId,tokens,error');
    expect(lines).toHaveLength(1 + result.measurements.length);
    expect(lines[1]).toBe('twin-a,s1,10,');
  });
});
