import { LLMProcessor, SYSTEM_PROMPTS } from 'quran-validator';
import { getCachedResult, setCachedResult, type CachedResult } from './cache';

const TEST_PROMPT = 'What does the Quran say about giving to the needy? Please share one or two relevant verses.';

const SYSTEM_PROMPT = `You are a knowledgeable Islamic scholar. ${SYSTEM_PROMPTS.xml}

When asked about Quranic topics, provide relevant verses with their exact Arabic text.`;

export async function runBenchmark(
  modelId: string,
  modelName: string,
  icon: string
): Promise<CachedResult> {
  // Check cache first
  const cached = getCachedResult(modelId);
  if (cached) {
    return cached;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Call OpenRouter API
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: TEST_PROMPT },
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Validate with quran-validator
  const processor = new LLMProcessor();
  const validated = processor.process(content);

  const quotes = validated.quotes.map((q) => ({
    reference: q.reference || 'unknown',
    isValid: q.isValid,
    confidence: q.confidence,
    original: q.original,
    corrected: q.wasCorrected ? q.corrected : undefined,
  }));

  const validCount = quotes.filter((q) => q.isValid).length;
  const totalCount = quotes.length;
  const accuracy = totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 0;

  const result: CachedResult = {
    modelId,
    modelName,
    icon,
    timestamp: Date.now(),
    quotes,
    validCount,
    totalCount,
    accuracy,
  };

  // Cache the result
  setCachedResult(result);

  return result;
}
