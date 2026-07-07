# Claude Tokenizer Measurement Experiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript experiment that counts how many input tokens each Claude model assigns to a fixed corpus, discovers the tokenizer-family partition by clustering, and reports per-model dollar cost.

**Architecture:** Pure data modules (corpus, models) feed a runner that calls the Anthropic `count_tokens` endpoint through an injectable count function. A pure report module clusters models by identical token vectors, sums tokens per category, and computes cost. An entry point wires the real SDK, prints tables, and writes `results.json` and `results.csv`. The count function is injected so all logic is unit-tested without network access.

**Tech Stack:** Node.js, TypeScript, `@anthropic-ai/sdk`, Vitest (tests), tsx (run).

## Global Constraints

- Language: TypeScript, ES modules (`"type": "module"` in package.json). Imports are extensionless (resolved by tsx and Vitest).
- Token counting uses `client.messages.countTokens(...)` only. No `messages.create` calls anywhere.
- No API key is hardcoded. The client is constructed zero-arg (`new Anthropic()`) so ambient credentials (including an `ant auth login` OAuth profile) are used.
- Pricing values are cached as of 2026-06 and carry an explicit comment saying they must be re-verified before drawing cost conclusions.
- All source lives under `src/`, all tests under `tests/`, all generated output under `output/`.
- This directory is not yet a git repository. Task 1 runs `git init`. If you prefer no version control, skip every `git commit` step; nothing else depends on git.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json` (via npm)
- Create: `tsconfig.json`
- Create: `tests/smoke.test.ts`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a working toolchain — `npm test` runs Vitest, `npm run experiment` runs `tsx src/index.ts`.

- [ ] **Step 1: Initialize git and npm**

```bash
cd /d/Repos/tokenizer
git init
npm init -y
```

- [ ] **Step 2: Set package fields and scripts**

```bash
npm pkg set name=hakari
npm pkg set type=module
npm pkg set scripts.test="vitest run"
npm pkg set scripts.experiment="tsx src/index.ts"
```

- [ ] **Step 3: Install dependencies**

```bash
npm install @anthropic-ai/sdk
npm install -D typescript vitest tsx @types/node
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
output/
```

- [ ] **Step 6: Write the smoke test**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run the smoke test**

Run: `npm test`
Expected: PASS — 1 test passing in `tests/smoke.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold TypeScript tokenizer experiment"
```

---

### Task 2: Shared types and corpus

**Files:**
- Create: `src/types.ts`
- Create: `src/corpus.ts`
- Test: `tests/corpus.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Category = 'english' | 'code' | 'json' | 'non-english'`
  - `interface Sample { id: string; category: Category; text: string }`
  - `interface ModelSpec { id: string; inputPricePerMillion: number }`
  - `interface Measurement { model: string; sampleId: string; tokens: number | null; error?: string }`
  - `interface OverheadBaseline { model: string; tokens: number | null; error?: string }`
  - `interface RunResult { measurements: Measurement[]; overhead: OverheadBaseline[] }`
  - `type CountTokens = (model: string, text: string) => Promise<number>`
  - `const SAMPLES: Sample[]`

- [ ] **Step 1: Write the failing test**

Create `tests/corpus.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/corpus.test.ts`
Expected: FAIL — cannot resolve `../src/corpus`.

- [ ] **Step 3: Create `src/types.ts`**

```ts
export type Category = 'english' | 'code' | 'json' | 'non-english';

export interface Sample {
  id: string;
  category: Category;
  text: string;
}

export interface ModelSpec {
  id: string;
  inputPricePerMillion: number;
}

export interface Measurement {
  model: string;
  sampleId: string;
  tokens: number | null;
  error?: string;
}

export interface OverheadBaseline {
  model: string;
  tokens: number | null;
  error?: string;
}

export interface RunResult {
  measurements: Measurement[];
  overhead: OverheadBaseline[];
}

export type CountTokens = (model: string, text: string) => Promise<number>;
```

- [ ] **Step 4: Create `src/corpus.ts`**

```ts
import type { Sample } from './types';

export const SAMPLES: Sample[] = [
  {
    id: 'english-1',
    category: 'english',
    text: 'The quick brown fox jumps over the lazy dog. Tokenizers split this ordinary English sentence into subword units, and the exact number of units depends on the model that produced the vocabulary.',
  },
  {
    id: 'english-2',
    category: 'english',
    text: 'Prompt engineering is less about clever wording and more about giving the model the context it needs. A well-scoped request beats a long, meandering one every single time.',
  },
  {
    id: 'code-1',
    category: 'code',
    text: 'export function fibonacci(n: number): number {\n  if (n < 2) return n;\n  let a = 0, b = 1;\n  for (let i = 2; i <= n; i++) {\n    const next = a + b;\n    a = b;\n    b = next;\n  }\n  return b;\n}\n',
  },
  {
    id: 'code-2',
    category: 'code',
    text: 'def merge_sort(items):\n    if len(items) <= 1:\n        return items\n    mid = len(items) // 2\n    left = merge_sort(items[:mid])\n    right = merge_sort(items[mid:])\n    return _merge(left, right)\n',
  },
  {
    id: 'json-1',
    category: 'json',
    text: '{"id":1042,"name":"Ada Lovelace","roles":["author","analyst"],"active":true,"scores":{"math":98,"logic":100},"tags":[]}',
  },
  {
    id: 'json-2',
    category: 'json',
    text: '{"orders":[{"sku":"A-1","qty":3,"price":19.99},{"sku":"B-7","qty":1,"price":249.0}],"currency":"USD","meta":null}',
  },
  {
    id: 'non-english-1',
    category: 'non-english',
    text: '東京は日本の首都であり、世界で最も人口の多い都市圏のひとつです。トークナイザーは、こうした文章をどのように分割するのでしょうか。',
  },
  {
    id: 'non-english-2',
    category: 'non-english',
    text: 'Les modèles de langage découpent le texte en unités plus petites. Cette phrase en français, avec ses accents, illustre comment la tokenisation varie selon la langue.',
  },
];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/corpus.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shared types and fixed corpus"
```

---

### Task 3: Model sweep list and pricing

**Files:**
- Create: `src/models.ts`
- Test: `tests/models.test.ts`

**Interfaces:**
- Consumes: `ModelSpec` from `src/types`.
- Produces: `const MODELS: ModelSpec[]` — the default sweep, spanning both suspected tokenizer families.

- [ ] **Step 1: Write the failing test**

Create `tests/models.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/models.test.ts`
Expected: FAIL — cannot resolve `../src/models`.

- [ ] **Step 3: Create `src/models.ts`**

```ts
import type { ModelSpec } from './types';

// Input pricing in USD per 1,000,000 input tokens.
// CACHED as of 2026-06. Re-verify per-token rates before drawing cost
// conclusions — Anthropic pricing changes and intro rates expire.
export const MODELS: ModelSpec[] = [
  // New-family suspects (tokenizer introduced with Opus 4.7).
  { id: 'claude-opus-4-8', inputPricePerMillion: 5 },
  { id: 'claude-opus-4-7', inputPricePerMillion: 5 },
  { id: 'claude-sonnet-5', inputPricePerMillion: 3 },
  { id: 'claude-fable-5', inputPricePerMillion: 10 },
  // Old-family suspects.
  { id: 'claude-opus-4-6', inputPricePerMillion: 5 },
  { id: 'claude-sonnet-4-6', inputPricePerMillion: 3 },
  { id: 'claude-haiku-4-5', inputPricePerMillion: 1 },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/models.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add model sweep list with cached pricing"
```

---

### Task 4: Measurement runner

**Files:**
- Create: `src/measure.ts`
- Test: `tests/measure.test.ts`

**Interfaces:**
- Consumes: `CountTokens`, `ModelSpec`, `Sample`, `RunResult`, `Measurement`, `OverheadBaseline` from `src/types`.
- Produces:
  - `class AuthError extends Error`
  - `async function measureAll(models: ModelSpec[], samples: Sample[], count: CountTokens): Promise<RunResult>` — one measurement per model x sample, plus one overhead baseline per model (counting the single-character probe `'a'`). A count call that throws with `.status` 401 or 403 aborts the whole run with `AuthError`. Any other thrown error is recorded as `tokens: null` with the message in `error`, and the run continues.
  - `function makeAnthropicCounter(client): CountTokens` — wraps `client.messages.countTokens` and returns `input_tokens`.

- [ ] **Step 1: Write the failing test**

Create `tests/measure.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { measureAll, makeAnthropicCounter, AuthError } from '../src/measure';
import type { ModelSpec, Sample, CountTokens } from '../src/types';

const models: ModelSpec[] = [
  { id: 'model-a', inputPricePerMillion: 5 },
  { id: 'model-b', inputPricePerMillion: 1 },
];
const samples: Sample[] = [
  { id: 's1', category: 'english', text: 'hello' },
  { id: 's2', category: 'json', text: '{}' },
];

describe('measureAll', () => {
  it('produces a measurement per model x sample and an overhead per model', async () => {
    const count: CountTokens = async (model, text) => text.length + model.length;
    const result = await measureAll(models, samples, count);
    expect(result.measurements).toHaveLength(4);
    expect(result.overhead).toHaveLength(2);
    const a1 = result.measurements.find((m) => m.model === 'model-a' && m.sampleId === 's1');
    expect(a1?.tokens).toBe('hello'.length + 'model-a'.length);
  });

  it('records non-auth errors as null tokens and keeps going', async () => {
    const count: CountTokens = async (_model, text) => {
      if (text === '{}') throw new Error('boom');
      return text.length;
    };
    const result = await measureAll(models, samples, count);
    const bad = result.measurements.filter((m) => m.sampleId === 's2');
    expect(bad).toHaveLength(2);
    for (const m of bad) {
      expect(m.tokens).toBeNull();
      expect(m.error).toContain('boom');
    }
    const good = result.measurements.filter((m) => m.sampleId === 's1');
    expect(good.every((m) => typeof m.tokens === 'number')).toBe(true);
  });

  it('throws AuthError on a 401 status', async () => {
    const count: CountTokens = async () => {
      throw Object.assign(new Error('unauthorized'), { status: 401 });
    };
    await expect(measureAll(models, samples, count)).rejects.toBeInstanceOf(AuthError);
  });

  it('makeAnthropicCounter returns input_tokens', async () => {
    const fakeClient = {
      messages: {
        countTokens: async (args: { model: string; messages: { role: 'user'; content: string }[] }) => {
          expect(args.model).toBe('model-a');
          expect(args.messages[0].content).toBe('hi');
          return { input_tokens: 42 };
        },
      },
    };
    const count = makeAnthropicCounter(fakeClient);
    expect(await count('model-a', 'hi')).toBe(42);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/measure.test.ts`
Expected: FAIL — cannot resolve `../src/measure`.

- [ ] **Step 3: Create `src/measure.ts`**

```ts
import type {
  CountTokens,
  ModelSpec,
  Sample,
  RunResult,
  Measurement,
  OverheadBaseline,
} from './types';

export class AuthError extends Error {}

const OVERHEAD_PROBE = 'a';

function isAuthStatus(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}

function authError(modelId: string): AuthError {
  return new AuthError(
    `Authentication failed calling count_tokens for model ${modelId}. ` +
      `If you are using an OAuth login (ant auth login), it may lack API scope. ` +
      `Fix: set ANTHROPIC_API_KEY, or run "ant auth login" with API access.`,
  );
}

function message(err: unknown): string {
  return String((err as Error)?.message ?? err);
}

export async function measureAll(
  models: ModelSpec[],
  samples: Sample[],
  count: CountTokens,
): Promise<RunResult> {
  const measurements: Measurement[] = [];
  const overhead: OverheadBaseline[] = [];

  for (const model of models) {
    try {
      const tokens = await count(model.id, OVERHEAD_PROBE);
      overhead.push({ model: model.id, tokens });
    } catch (err) {
      if (isAuthStatus(err)) throw authError(model.id);
      overhead.push({ model: model.id, tokens: null, error: message(err) });
    }

    for (const sample of samples) {
      try {
        const tokens = await count(model.id, sample.text);
        measurements.push({ model: model.id, sampleId: sample.id, tokens });
      } catch (err) {
        if (isAuthStatus(err)) throw authError(model.id);
        measurements.push({
          model: model.id,
          sampleId: sample.id,
          tokens: null,
          error: message(err),
        });
      }
    }
  }

  return { measurements, overhead };
}

interface CountTokensClient {
  messages: {
    countTokens: (args: {
      model: string;
      messages: { role: 'user'; content: string }[];
    }) => Promise<{ input_tokens: number }>;
  };
}

export function makeAnthropicCounter(client: CountTokensClient): CountTokens {
  return async (model, text) => {
    const res = await client.messages.countTokens({
      model,
      messages: [{ role: 'user', content: text }],
    });
    return res.input_tokens;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/measure.test.ts`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add measurement runner with injectable counter"
```

---

### Task 5: Report analysis (clustering, category totals, cost, CSV)

**Files:**
- Create: `src/report.ts`
- Test: `tests/report.test.ts`

**Interfaces:**
- Consumes: `RunResult`, `Sample`, `ModelSpec`, `Category` from `src/types`.
- Produces:
  - `interface Cluster { models: string[] }`
  - `function clusterModels(result: RunResult, models: ModelSpec[], samples: Sample[]): Cluster[]` — groups models with identical, fully-populated token vectors (models with any `null` measurement are excluded from clustering).
  - `function categoryTotals(result: RunResult, samples: Sample[], models: ModelSpec[]): Map<string, Map<Category, number>>` — per-model token sums by category (nulls skipped).
  - `interface CostRow { model: string; sampleId: string; tokens: number; dollars: number }`
  - `function costTable(result: RunResult, models: ModelSpec[]): CostRow[]`
  - `function toCsv(result: RunResult): string`

- [ ] **Step 1: Write the failing test**

Create `tests/report.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/report.test.ts`
Expected: FAIL — cannot resolve `../src/report`.

- [ ] **Step 3: Create `src/report.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/report.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add report analysis (clustering, totals, cost, csv)"
```

---

### Task 6: Entry point (wire SDK, print, write files)

**Files:**
- Create: `src/index.ts`

**Interfaces:**
- Consumes: `SAMPLES` from `src/corpus`; `MODELS` from `src/models`; `measureAll`, `makeAnthropicCounter`, `AuthError` from `src/measure`; `clusterModels`, `categoryTotals`, `costTable`, `toCsv` from `src/report`; `Anthropic` from `@anthropic-ai/sdk`.
- Produces: an executable `main()` that runs the sweep, prints the matrix / clusters / category totals / cost table, and writes `output/results.json` and `output/results.csv`. On `AuthError` it prints the actionable message and exits with code 1.

- [ ] **Step 1: Create `src/index.ts`**

```ts
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
```

- [ ] **Step 2: Verify the full test suite still passes**

Run: `npm test`
Expected: PASS — all tests from Tasks 1-5 pass (smoke, corpus, models, measure, report).

- [ ] **Step 3: Manual smoke run against the real API**

Run: `npm run experiment`
Expected (auth working): prints the token matrix, the cluster summary (Opus 4.8 / Opus 4.7 / Sonnet 5 / Fable 5 expected to cluster together; Sonnet 4.6 / Haiku 4.5 / Opus 4.6 expected in one or more other clusters), the per-category totals, and the cost table; then writes `output/results.json` and `output/results.csv`.
Expected (OAuth lacks API scope): prints `AUTH ERROR:` with the fix instructions and exits with code 1. If this happens, set `ANTHROPIC_API_KEY` and re-run.
Note: a model your account cannot access is recorded as `ERR` in its column and does not abort the run.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add entry point that runs sweep and writes results"
```

---

## Self-Review Notes

Spec coverage: count_tokens method (Tasks 4, 6); ambient/OAuth auth + graceful auth error (Tasks 4, 6); real-world gross tokens as headline metric (Tasks 4, 6); overhead baseline diagnostic (Task 4 `OVERHEAD_PROBE`); four corpus categories (Task 2); dual-family model sweep + cached pricing with re-verify note (Task 3); empirical clustering (Task 5); per-category deltas via `categoryTotals` (Tasks 5, 6); cost table exposing shared-tokenizer/different-price cases (Tasks 5, 6); model-unavailable skip and per-cell error isolation (Task 4); JSON + CSV output (Tasks 5, 6). All covered.

Type consistency: `Sample`, `ModelSpec`, `Measurement`, `OverheadBaseline`, `RunResult`, `CountTokens` are defined once in `src/types.ts` (Task 2) and consumed unchanged by Tasks 3-6. `measureAll`, `makeAnthropicCounter`, `AuthError`, `clusterModels`, `categoryTotals`, `costTable`, `toCsv` signatures match between their producing task and every consumer.
