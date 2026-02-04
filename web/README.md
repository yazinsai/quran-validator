# Quran Validator Leaderboard

A hosted web app that benchmarks how accurately different LLMs can quote the Quran.

## Features

- Test any model available on [OpenRouter](https://openrouter.ai)
- Results are cached - same model is never tested twice
- Leaderboard sorted by accuracy
- Detailed view shows each quoted verse with validation status

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file with your OpenRouter API key:
   ```bash
   cp .env.example .env
   # Edit .env with your API key
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## How It Works

1. User enters an OpenRouter model ID (e.g., `anthropic/claude-3.5-sonnet`)
2. The app sends a test prompt asking for Quranic verses
3. The response is validated using the `quran-validator` package
4. Results are cached to `cache.json` and displayed on the leaderboard

## Deployment

This app can be deployed to Vercel:

```bash
npm run build
```

Make sure to set `OPENROUTER_API_KEY` in your environment variables.
