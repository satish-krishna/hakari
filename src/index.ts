import { mkdirSync, writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { SAMPLES } from './corpus';
import { MODELS } from './models';
import { measureAll, makeAnthropicCounter, AuthError } from './measure';
import { clusterModels, categoryTotals, costTable, toCsv } from './report';
import type { RunResult } from './types';

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
  const clusters = clusterModels(result, MODELS, SAMPLES);
  clusters.forEach((c, i) => {
    console.log(`  Cluster ${i + 1}: ${c.models.join(', ')}`);
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
  const anySuccess = result.measurements.some((m) => m.tokens !== null);
  if (!anySuccess) {
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
