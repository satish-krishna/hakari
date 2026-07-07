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
