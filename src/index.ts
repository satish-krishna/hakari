import { mkdirSync, writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { SAMPLES } from './corpus';
import { MODELS } from './models';
import { measureAll, makeAnthropicCounter, AuthError } from './measure';
import {
  clusterModels,
  categoryTotals,
  categoryDeltas,
  costTable,
  hasAnySuccess,
  toCsv,
} from './report';
import type { RunResult } from './types';

function overheadOf(result: RunResult, modelId: string): number | null {
  return result.overhead.find((o) => o.model === modelId)?.tokens ?? null;
}

function printMatrix(result: RunResult): void {
  console.log('\n=== Token counts (rows = samples, cols = models) ===');
  const header = ['sample'.padEnd(16), ...MODELS.map((m) => m.id.padStart(18))].join('');
  console.log(header);
  for (const sample of SAMPLES) {
    const cells = MODELS.map((model) => {
      const m = result.measurements.find((x) => x.model === model.id && x.sampleId === sample.id);
      const val = m && m.tokens !== null ? String(m.tokens) : 'ERR';
      return val.padStart(18);
    });
    console.log([sample.id.padEnd(16), ...cells].join(''));
  }
}

function printClusters(result: RunResult): void {
  console.log('\n=== Tokenizer clusters (models with identical token vectors) ===');
  console.log('  [oh=N] = fixed per-request overhead tokens (count of the probe "a").');
  console.log('  Clustering uses gross tokens. If two clusters differ by a constant offset on');
  console.log('  every sample equal to their overhead gap, they may actually share a tokenizer.');
  const clusters = clusterModels(result, MODELS, SAMPLES);
  clusters.forEach((c, i) => {
    const members = c.models.map((id) => `${id}[oh=${overheadOf(result, id) ?? 'ERR'}]`).join(', ');
    console.log(`  Cluster ${i + 1}: ${members}`);
    const distinctOverheads = new Set(c.models.map((id) => String(overheadOf(result, id))));
    if (distinctOverheads.size > 1) {
      console.log(
        '    WARNING: overhead differs within this cluster — members may use different request scaffolding.',
      );
    }
  });
  const clustered = new Set(clusters.flatMap((c) => c.models));
  const incomplete = MODELS.map((m) => m.id).filter((id) => !clustered.has(id));
  if (incomplete.length > 0) {
    console.log(`  Incomplete (errors, not clustered): ${incomplete.join(', ')}`);
  }
}

function printCategoryTotals(result: RunResult): void {
  console.log('\n=== Total tokens per category per model ===');
  const totals = categoryTotals(result, SAMPLES, MODELS);
  const catSet = [...new Set(SAMPLES.map((s) => s.category))];
  console.log(['model'.padEnd(20), ...catSet.map((c) => c.padStart(14))].join(''));
  for (const model of MODELS) {
    const cats = totals.get(model.id);
    const cells = catSet.map((c) => String(cats?.get(c) ?? 0).padStart(14));
    console.log([model.id.padEnd(20), ...cells].join(''));
  }
}

function printCategoryDeltas(result: RunResult): void {
  console.log('\n=== Per-category token delta between clusters (vs the lightest cluster) ===');
  const delta = categoryDeltas(result, MODELS, SAMPLES);
  if (delta.baselineModels.length === 0 || delta.comparisons.length === 0) {
    console.log('  (need at least two complete clusters to compute a delta)');
    return;
  }
  const catSet = [...new Set(SAMPLES.map((s) => s.category))];
  console.log(`  baseline cluster: ${delta.baselineModels.join(', ')}`);
  console.log(['  cluster'.padEnd(24), ...catSet.map((c) => c.padStart(12))].join(''));
  for (const cmp of delta.comparisons) {
    const cells = catSet.map((c) => {
      const d = cmp.deltaPct.get(c);
      const text = d === null || d === undefined ? 'n/a' : `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
      return text.padStart(12);
    });
    const label = `  ${cmp.models.join(',')}`.padEnd(24).slice(0, 24);
    console.log([label, ...cells].join(''));
  }
}

function printCost(result: RunResult): void {
  console.log('\n=== Total input cost per model (all samples summed) ===');
  const rows = costTable(result, MODELS);
  for (const model of MODELS) {
    const modelRows = rows.filter((r) => r.model === model.id);
    const tokens = modelRows.reduce((a, r) => a + r.tokens, 0);
    const dollars = modelRows.reduce((a, r) => a + r.dollars, 0);
    console.log(
      `  ${model.id.padEnd(20)} ${String(tokens).padStart(8)} tok  $${dollars.toFixed(8)}  ($${model.inputPricePerMillion}/1M)`,
    );
  }
  console.log('  (pricing cached 2026-06 — re-verify before quoting costs)');
}

async function main(): Promise<void> {
  const client = new Anthropic();
  const count = makeAnthropicCounter(client);

  let result: RunResult;
  try {
    result = await measureAll(MODELS, SAMPLES, count);
  } catch (err) {
    if (err instanceof AuthError) {
      console.error(`\nAUTH ERROR: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  // If nothing succeeded, the run failed as a whole (missing credentials,
  // no connectivity, etc.). Do not write misleading all-ERR output with a
  // success exit code — surface actionable guidance and exit non-zero.
  if (!hasAnySuccess(result)) {
    const firstError = result.measurements.find((m) => m.error)?.error ?? 'unknown error';
    console.error(
      '\nRUN FAILED: every measurement errored — no token counts were produced.\n' +
        'This usually means credentials are missing or cannot reach the count_tokens endpoint.\n' +
        'Fix: set ANTHROPIC_API_KEY, or run "ant auth login" with API access, then retry.\n' +
        `First error: ${firstError}\n`,
    );
    process.exit(1);
  }

  printMatrix(result);
  printClusters(result);
  printCategoryTotals(result);
  printCategoryDeltas(result);
  printCost(result);

  mkdirSync('output', { recursive: true });
  writeFileSync(
    'output/results.json',
    JSON.stringify(
      {
        source: 'count_tokens',
        generatedNote: 'Real-world input tokens (per-request overhead included).',
        models: MODELS,
        samples: SAMPLES.map((s) => ({ id: s.id, category: s.category })),
        result,
      },
      null,
      2,
    ),
  );
  writeFileSync('output/results.csv', toCsv(result));
  console.log('\nWrote output/results.json and output/results.csv');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
