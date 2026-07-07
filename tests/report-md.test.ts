import { describe, it, expect } from 'vitest';
import { buildReportMarkdown, type ResultsFile, type CorpusEntry } from '../src/report-md';

const data: ResultsFile = {
  generatedNote: 'test run',
  models: [
    { id: 'twin-a', inputPricePerMillion: 5 },
    { id: 'twin-b', inputPricePerMillion: 10 },
  ],
  samples: [
    { id: 's1', category: 'english' },
    { id: 's2', category: 'code' },
  ],
  result: {
    overhead: [
      { model: 'twin-a', tokens: 5 },
      { model: 'twin-b', tokens: 10 },
    ],
    measurements: [
      { model: 'twin-a', sampleId: 's1', tokens: 15 }, // content 10
      { model: 'twin-a', sampleId: 's2', tokens: 25 }, // content 20
      { model: 'twin-b', sampleId: 's1', tokens: 20 }, // content 10
      { model: 'twin-b', sampleId: 's2', tokens: 30 }, // content 20
    ],
  },
};

const corpus = new Map<string, CorpusEntry>([
  ['s1', { category: 'english', text: 'hello world' }],
  ['s2', { category: 'code', text: 'const x = 1;' }],
  ['s3', { category: 'json', text: '{}' }], // extra corpus sample not in the run
]);

describe('buildReportMarkdown', () => {
  const md = buildReportMarkdown(data, corpus);

  it('includes the input index with the actual sample text', () => {
    expect(md).toContain('input index (the actual text measured)');
    expect(md).toContain('`s1` — english');
    expect(md).toContain('hello world');
    expect(md).toContain('const x = 1;');
  });

  it('flags corpus samples not present in the run', () => {
    expect(md).toContain('Consistency check');
    expect(md).toContain('s3');
  });

  it('renders the token matrix and the cost table', () => {
    expect(md).toContain('## Token counts (gross)');
    expect(md).toContain('| s1 | 15 | 20 |');
    expect(md).toContain('## Input cost per model');
  });

  it('merges the two models under content clustering once overhead is removed', () => {
    // gross: twin-a [15,25] vs twin-b [20,30] -> 2 clusters
    // content: both [10,20] -> 1 cluster
    expect(md).toContain('content only (overhead subtracted)');
    expect(md).toMatch(/Cluster 1:\*\* twin-a, twin-b/);
    expect(md).toContain('collapsed');
  });
});

describe('buildReportMarkdown near-miss detection', () => {
  // Two models whose CONTENT vectors differ on exactly one sample by 1 token.
  const near: ResultsFile = {
    models: [
      { id: 'x', inputPricePerMillion: 5 },
      { id: 'y', inputPricePerMillion: 5 },
    ],
    samples: [
      { id: 's1', category: 'english' },
      { id: 's2', category: 'code' },
    ],
    result: {
      overhead: [
        { model: 'x', tokens: 7 },
        { model: 'y', tokens: 12 },
      ],
      measurements: [
        { model: 'x', sampleId: 's1', tokens: 67 }, // content 60
        { model: 'x', sampleId: 's2', tokens: 95 }, // content 88
        { model: 'y', sampleId: 's1', tokens: 72 }, // content 60
        { model: 'y', sampleId: 's2', tokens: 101 }, // content 89 (differs by 1)
      ],
    },
  };
  const corpus2 = new Map<string, CorpusEntry>([
    ['s1', { category: 'english', text: 'a' }],
    ['s2', { category: 'code', text: 'b' }],
  ]);
  const md = buildReportMarkdown(near, corpus2);

  it('detects near-identical content clusters differing by a single sample', () => {
    expect(md).toContain('Near-identical tokenizers');
    expect(md).toContain('differ on 1 of 2 sample');
    expect(md).toContain('{x}** ≈ **{y}');
    expect(md).toContain('(88 vs 89)');
  });
});
