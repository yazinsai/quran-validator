# quran-validator Development Guidelines

## Testing Rule (CRITICAL)

**Before making ANY code changes, ALWAYS add failing test cases first, then fix them.**

This ensures:
1. The expected behavior is documented
2. Regressions are caught
3. The fix actually addresses the problem

## Project Overview

Quran text validation library for verifying LLM-generated Quranic quotes.

## Validation Logic

Simple binary matching:
- Normalize both input and stored verse text (strip diacritics, normalize characters)
- **Exact normalized match** → valid
- **No match** → invalid

No fuzzy matching, no confidence scores, no partial matching.

## Running Tests

```bash
npm test        # Run all tests
npm run build   # Build the package
```

## Web Benchmark

```bash
cd web
npx tsx scripts/rerun-cache.ts --concurrency=5  # Re-run cached benchmarks
```
