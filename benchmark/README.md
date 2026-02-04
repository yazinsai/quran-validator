# Quran Validator LLM Benchmark

Benchmark tool to test how accurately different LLMs can quote Quranic verses.

## Setup

```bash
cd benchmark
npm install
npx playwright install chromium
```

## Usage

1. Get an API key from [OpenRouter](https://openrouter.ai/)

2. Run the benchmark:
```bash
export OPENROUTER_API_KEY='your-key'
npm run benchmark
```

3. Generate screenshots (optional):
```bash
npm run screenshot
```

## Output

Results are saved to `results/`:
- `summary.html` - Leaderboard with all models
- `details.html` - Detailed diff view for errors
- `data.json` - Raw results data
- `summary.png` - Screenshot of leaderboard
- `details.png` - Screenshot of error details

## Customization

Edit `benchmark.ts` to customize:

```typescript
const CONFIG = {
  // Add/remove models
  models: [
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', icon: '🟤' },
    // ...
  ],

  // Change the test prompt
  prompt: 'What does the Quran say about giving to the needy?',
};
```

## How It Works

1. Each model receives a system prompt instructing it to quote Quran verses using XML tags:
   ```
   <quran ref="1:1">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</quran>
   ```

2. The `quran-validator` library validates each quoted verse against the authentic Quran database

3. Results show:
   - ✅ **Valid** - Exact or near-exact match
   - ⚠️ **Diacritic errors** - Correct letters, wrong vowel marks
   - ❌ **Invalid** - Misquoted or fabricated verse

## Example Results

![Summary](results/summary.png)

## License

MIT
