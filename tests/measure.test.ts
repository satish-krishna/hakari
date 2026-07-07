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
