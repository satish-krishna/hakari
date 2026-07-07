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
