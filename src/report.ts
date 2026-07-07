import type { RunResult, Sample, ModelSpec, Category } from './types';

export interface Cluster {
  models: string[];
}

function vectorFor(result: RunResult, modelId: string, samples: Sample[]): (number | null)[] {
  return samples.map((s) => {
    const m = result.measurements.find((x) => x.model === modelId && x.sampleId === s.id);
    return m ? m.tokens : null;
  });
}

export function clusterModels(
  result: RunResult,
  models: ModelSpec[],
  samples: Sample[],
): Cluster[] {
  const groups = new Map<string, string[]>();
  for (const model of models) {
    const vec = vectorFor(result, model.id, samples);
    if (vec.some((t) => t === null)) continue; // skip incomplete models
    const key = JSON.stringify(vec);
    const list = groups.get(key) ?? [];
    list.push(model.id);
    groups.set(key, list);
  }
  return [...groups.values()].map((m) => ({ models: m }));
}

export function categoryTotals(
  result: RunResult,
  samples: Sample[],
  models: ModelSpec[],
): Map<string, Map<Category, number>> {
  const byId = new Map(samples.map((s) => [s.id, s]));
  const out = new Map<string, Map<Category, number>>();
  for (const model of models) {
    const cats = new Map<Category, number>();
    for (const m of result.measurements) {
      if (m.model !== model.id || m.tokens === null) continue;
      const sample = byId.get(m.sampleId);
      if (!sample) continue;
      cats.set(sample.category, (cats.get(sample.category) ?? 0) + m.tokens);
    }
    out.set(model.id, cats);
  }
  return out;
}

export interface CostRow {
  model: string;
  sampleId: string;
  tokens: number;
  dollars: number;
}

export function costTable(result: RunResult, models: ModelSpec[]): CostRow[] {
  const price = new Map(models.map((m) => [m.id, m.inputPricePerMillion]));
  const rows: CostRow[] = [];
  for (const m of result.measurements) {
    if (m.tokens === null) continue;
    const p = price.get(m.model);
    if (p === undefined) continue;
    rows.push({
      model: m.model,
      sampleId: m.sampleId,
      tokens: m.tokens,
      dollars: (m.tokens / 1_000_000) * p,
    });
  }
  return rows;
}

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(result: RunResult): string {
  const header = 'model,sampleId,tokens,error';
  const lines = result.measurements.map((m) =>
    [csvField(m.model), csvField(m.sampleId), csvField(m.tokens ?? ''), csvField(m.error ?? '')].join(','),
  );
  return [header, ...lines].join('\n');
}

export function hasAnySuccess(result: RunResult): boolean {
  return result.measurements.some((m) => m.tokens !== null);
}

export interface CategoryDelta {
  baselineModels: string[];
  baselineTotals: Map<Category, number>;
  comparisons: Array<{ models: string[]; deltaPct: Map<Category, number | null> }>;
}

// Per-category percentage delta of each cluster vs the "lightest" cluster
// (the one with the smallest total tokens). Cluster members share an identical
// token vector, so the first member represents the cluster. deltaPct is null
// for a category whose baseline total is 0 (avoids divide-by-zero).
export function categoryDeltas(
  result: RunResult,
  models: ModelSpec[],
  samples: Sample[],
): CategoryDelta {
  const clusters = clusterModels(result, models, samples);
  const totals = categoryTotals(result, samples, models);
  const categories = [...new Set(samples.map((s) => s.category))];

  const info = clusters.map((c) => {
    const cats = totals.get(c.models[0]) ?? new Map<Category, number>();
    const grand = categories.reduce((a, cat) => a + (cats.get(cat) ?? 0), 0);
    return { models: c.models, cats, grand };
  });

  if (info.length === 0) {
    return { baselineModels: [], baselineTotals: new Map(), comparisons: [] };
  }

  const baseline = info.reduce((min, c) => (c.grand < min.grand ? c : min), info[0]);

  const comparisons = info
    .filter((c) => c !== baseline)
    .map((c) => {
      const deltaPct = new Map<Category, number | null>();
      for (const cat of categories) {
        const base = baseline.cats.get(cat) ?? 0;
        const val = c.cats.get(cat) ?? 0;
        deltaPct.set(cat, base === 0 ? null : ((val - base) / base) * 100);
      }
      return { models: c.models, deltaPct };
    });

  return { baselineModels: baseline.models, baselineTotals: baseline.cats, comparisons };
}
