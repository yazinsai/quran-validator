# Product Guardrails
- Quranic text accuracy is non-negotiable — no change may cause a valid verse to be rejected or an invalid quote to be accepted
- Simplicity over features — binary match (exact or normalized), no fuzzy matching or confidence scores in core validation
- Zero false positives — it is better to reject valid input than to accept fabricated Quranic text
- Hafs reading only — multi-qiraat support was intentionally removed; do not reintroduce it
- Zero runtime dependencies beyond `arabic-text-normalizer` — the library must stay lightweight and self-contained

# Risk Classification
## Always High Risk
- Any change to `data/quran-verses.json`, `data/quran-verses.min.json`, `data/quran-surahs.json`, or `data/quran-surahs.min.json` — these are the authoritative Quran database
- Any change to `data/normalized-index.json` — this drives lookup correctness
- Changes to `src/normalizer.ts` — normalization logic directly affects match accuracy
- Changes to `src/validator.ts` `validate()` or `validateAgainst()` methods — core validation logic
- Changes to `src/llm-integration.ts` that alter how quotes are parsed or corrected
- Modifications to `scripts/fetch-quran-data.ts` or `scripts/process-qul-data.ts` — data pipeline scripts that regenerate the Quran database
- Changes to `package.json` `exports`, `main`, `module`, or `types` fields — public API surface of the npm package
- Any change to the release pipeline (`.github/workflows/release-runner.yml`)

## Always Low Risk
- Documentation-only changes (README.md, CHANGELOG.md, benchmark/README.md)
- Test-only changes (`*.test.ts` files) that do not modify source
- Changes to `web/` frontend code (benchmark dashboard, not the core library)
- Changes to `benchmark/` directory
- `.gitignore` or editor config changes
- Dependency version bumps in `devDependencies` only

# Decision Rules
## Bugs
- If a verse is being incorrectly validated (false positive or false negative), treat as critical — accept immediately with `state:planned`
- Bug reports must include the Arabic text input and expected vs actual result
- If a bug report lacks the specific verse or input text, mark `state:needs-repro`
- Normalization bugs (diacritic handling, alef variants, hamza carriers) are high priority — they can silently affect all 6,236 verses

## Features
- Accept if it improves validation accuracy without adding complexity to the core matching logic
- Decline requests to add fuzzy matching, confidence scores, or partial matching to the core validator — this was intentionally removed
- Decline requests to add qiraat other than Hafs — this was intentionally scoped down
- New LLM tag formats (beyond xml/markdown/bracket/minimal) are acceptable if demand is clear
- New utility exports from `src/normalizer.ts` are low risk and generally acceptable
- Escalate to human if the feature would add a new runtime dependency

## External PRs
- The idea matters, the exact code doesn't — OK to reimplement rather than iterate on the PR
- Any PR touching `data/` files must be verified against the QUL/Tarteel source — do not trust contributed Quran data without verification
- PRs must include or update tests in `src/validator.test.ts` or `src/llm-integration.test.ts`
- PRs that break the public API (`src/index.ts` exports) require `release:major` and human review

# Repo-Specific Rules
- **Test-first rule**: The project CLAUDE.md mandates adding failing test cases before any code change — PRs without corresponding tests should be flagged
- **Protect the `data/` directory**: The JSON files under `data/` are the single source of truth for all 6,236 verses. Changes must only come through the `scripts/fetch-quran-data.ts` → `scripts/process-qul-data.ts` pipeline, never through manual edits
- **Normalization consistency**: `normalizeArabic()` and `normalizeFabrication()` in `src/normalizer.ts` must stay in sync — `normalizeFabrication` is a stricter superset using `stripHamza: true`
- **`src/types.ts` MatchType enum**: Currently `'exact' | 'normalized' | 'none'` — adding new match types is a breaking change since consumers may switch on these values
- **No `.min.json` drift**: `quran-verses.min.json` and `quran-surahs.min.json` must always be generated from their non-minified counterparts, never edited independently
- **Web app is separate**: The `web/` directory is the benchmark dashboard deployed to dokku — it has its own `package.json` and dependencies. Changes there do not affect the npm package
- **Squash merge only**: `repo-policy.yml` specifies squash merge strategy — enforce this for all PRs
- **npm publish safety**: The `prepublishOnly` script runs tests then build — never bypass this with `--ignore-scripts`
- **Arabic text in issues/PRs**: GitHub may render Arabic RTL text incorrectly — when reviewing, use `gh` to fetch raw content rather than relying on rendered markdown