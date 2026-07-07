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
