# hakari — Subagent-Driven Build Progress

Plan: docs/superpowers/plans/2026-07-07-claude-tokenizer-measurement.md
Worktree: none (fresh repo, nothing to isolate)

## Tasks
- Task 1: complete (commit 393c770, review clean; git-hygiene "Important" adjudicated as accepted — planning docs/ledger belong in repo)
- Task 2: complete (commit cf87b9b, review clean)
- Task 3: complete (commit bd684f7, review clean)
- Task 4: complete (commit 4a596d7, review clean)
- Task 5: complete (commit 61a14c6, review clean)
- Task 6: complete (commits b2ed34b + fix 7428b6d, review clean; added run-level no-success guard → exit 1 with credential guidance)

## Fast-follow (commit 8e87694, review clean): surfaced overhead in clusters, added per-category delta section + typecheck script + 5 tests (21/21 pass, tsc clean). Addressed findings #1/#2/#3/#4/#5. Clustering unchanged (still gross tokens; overhead display-only).
## Remaining logged (not done, user-deferred): #6 cause-branch failure msg, #7 CSV formula-injection guard, #8 verify model IDs, plus Task-1 package.json boilerplate/main cleanup.

## Final whole-branch review (Opus): mergeable, no Critical
- IMPORTANT #1: clustering keys on gross tokens (overhead included) → could false-split a true tokenizer family if two same-tokenizer models have different fixed overhead. Overhead baseline is measured but never surfaced. Decision pending with user.
- Minor #2: spec named a per-category delta ratio; index prints raw totals only.
- Minor #3: overhead baseline in JSON only, never displayed as overhead-vs-content (ties to #1).
- Minor #4: no `tsc --noEmit` typecheck gate in package.json scripts.
- Minor #5: index.ts (clustering/display/exit paths) and csvField escaping branch untested.
- Minor #6: total-failure message assumes creds cause; could be model 404s (firstError mitigates).
- Minor #7: csvField doesn't neutralize leading = + - @ (CSV formula injection; source is SDK error strings, low risk).
- Minor #8: model IDs speculative — verify IDs (not just prices) before quoting real numbers.

## Prior per-task minor findings (for triage)
- Task 1: package.json `main` points to nonexistent `index.js` (project runs src/index.ts via tsx). Harmless dead metadata; consider removing.
- Task 1: npm-init boilerplate fields (author, license ISC, keywords, description) add noise to package.json.
- Task 5: vectorFor does Array.find per (model,sample,measurement) — O(n^3)-ish; fine at current scale, could use a Map keyed by model|sampleId if data grows.
- Task 5: csvField escape regex covers comma/quote/\n but not a lone \r; no practical risk with current data.
