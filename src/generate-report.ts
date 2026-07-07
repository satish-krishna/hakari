import { readFileSync, writeFileSync } from 'node:fs';
import { SAMPLES } from './corpus';
import { buildReportMarkdown, type ResultsFile, type CorpusEntry } from './report-md';

const RESULTS_PATH = 'output/results.json';
const REPORT_PATH = 'REPORT.md';

function main(): void {
  let raw: string;
  try {
    raw = readFileSync(RESULTS_PATH, 'utf8');
  } catch {
    console.error(
      `\nNo results found at ${RESULTS_PATH}.\n` +
        'Run "npm run experiment" first (it writes output/results.json), then re-run "npm run report".\n',
    );
    process.exit(1);
    return;
  }

  const data = JSON.parse(raw) as ResultsFile;
  const corpus = new Map<string, CorpusEntry>(
    SAMPLES.map((s) => [s.id, { category: s.category, text: s.text }]),
  );

  const markdown = buildReportMarkdown(data, corpus);
  writeFileSync(REPORT_PATH, markdown);
  console.log(
    `Wrote ${REPORT_PATH} (${data.samples.length} samples x ${data.models.length} models).`,
  );
}

main();
