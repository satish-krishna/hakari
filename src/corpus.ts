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
    id: 'code-3',
    category: 'code',
    // A larger, realistic module so code tokenization is stressed beyond the
    // toy snippets above. Kept free of backticks and template placeholders so
    // it can live inside this template literal unescaped.
    text: `/**
 * A bounded in-memory cache with per-entry time-to-live (TTL) and
 * least-recently-used (LRU) eviction. Entries expire after their TTL, and the
 * least-recently-used entry is dropped when the cache exceeds its capacity.
 */
export interface CacheOptions {
  maxEntries: number;
  defaultTtlMs: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TtlLruCache<K, V> {
  private readonly map = new Map<K, Entry<V>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions) {
    if (options.maxEntries <= 0) {
      throw new Error('maxEntries must be greater than zero');
    }
    if (options.defaultTtlMs <= 0) {
      throw new Error('defaultTtlMs must be greater than zero');
    }
    this.maxEntries = options.maxEntries;
    this.defaultTtlMs = options.defaultTtlMs;
  }

  get(key: K, now: number = Date.now()): V | undefined {
    const entry = this.map.get(key);
    if (entry === undefined) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      this.misses += 1;
      return undefined;
    }
    // Move the key to the most-recently-used position by reinserting it.
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number = this.defaultTtlMs, now: number = Date.now()): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, { value, expiresAt: now + ttlMs });
    this.evictIfNeeded(now);
  }

  has(key: K, now: number = Date.now()): boolean {
    return this.get(key, now) !== undefined;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }

  get size(): number {
    return this.map.size;
  }

  stats(): { hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    const hitRate = total === 0 ? 0 : this.hits / total;
    return { hits: this.hits, misses: this.misses, hitRate };
  }

  private evictIfNeeded(now: number): void {
    this.pruneExpired(now);
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.map.delete(oldest);
    }
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.map) {
      if (entry.expiresAt <= now) {
        this.map.delete(key);
      }
    }
  }
}
`,
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
