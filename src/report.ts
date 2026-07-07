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
