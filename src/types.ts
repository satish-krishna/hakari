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
