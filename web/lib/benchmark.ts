import { LLMProcessor, SYSTEM_PROMPTS, QuranValidator } from 'quran-validator';
import {
  getCachedResult,
  setCachedResult,
  type CachedResult,
  type CachedQuote,
  type InvalidReason,
  type PromptType,
  type PromptResult,
} from './cache';

// Test prompts designed to catch different error types
const TEST_PROMPTS: { type: PromptType; prompt: string; expectedRef?: string }[] = [
  {
    type: 'topical',
    prompt: 'What does the Quran say about giving to the needy? Please share one or two relevant verses.',
  },
  {
    type: 'specific',
    prompt: 'Please quote Ayat al-Kursi (Quran 2:255) in Arabic.',
    expectedRef: '2:255',
  },
];

const SYSTEM_PROMPT = `You are a knowledgeable Islamic scholar. ${SYSTEM_PROMPTS.xml}

When asked about Quranic topics, provide relevant verses with their exact Arabic text.`;

// Initialize validator once for reference checking
const validator = new QuranValidator();

function isValidReference(ref: string): boolean {
  const match = ref.match(/^(\d+):(\d+)$/);
  if (!match) return false;
  const surah = parseInt(match[1], 10);
  const ayah = parseInt(match[2], 10);
  return validator.getVerse(surah, ayah) !== undefined;
}

function getExpectedVerseText(ref: string): string | null {
  const match = ref.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  const surah = parseInt(match[1], 10);
  const ayah = parseInt(match[2], 10);
  const verse = validator.getVerse(surah, ayah);
  return verse?.text || null;
}

function determineInvalidReason(
  quote: {
    isValid: boolean;
    wasCorrected: boolean;
    corrected: string;
    confidence: number;
    reference?: string;
  },
  expectedRef?: string
): InvalidReason {
  if (quote.isValid && !quote.wasCorrected) return null;

  // Check if cited reference doesn't exist
  if (quote.reference && !isValidReference(quote.reference)) {
    return 'invalid_reference';
  }

  // Check if text is from a different verse than claimed
  if (expectedRef && quote.reference && quote.reference !== expectedRef) {
    // The text might be valid Quran, just not the verse they claimed
    if (quote.isValid || quote.confidence > 0.8) {
      return 'wrong_reference';
    }
  }

  // If there's a corrected version with high confidence, it's likely diacritics
  if (quote.wasCorrected && quote.corrected && quote.confidence >= 0.9) {
    return 'diacritics_error';
  }

  // Partial match with decent confidence = some words are real
  if (quote.confidence >= 0.5 && quote.confidence < 0.85) {
    return 'hallucinated_words';
  }

  // Very low confidence = likely fabricated
  if (quote.confidence < 0.5) {
    return 'fabricated';
  }

  // Medium confidence with correction = truncated or partial
  if (quote.wasCorrected && quote.confidence >= 0.7) {
    return 'truncated';
  }

  return 'fabricated';
}

function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

async function runSinglePrompt(
  modelId: string,
  promptConfig: { type: PromptType; prompt: string; expectedRef?: string },
  apiKey: string
): Promise<PromptResult> {
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
        { role: 'user', content: promptConfig.prompt },
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

  // Check if response contains any Arabic
  const hasArabic = containsArabic(content);

  if (!hasArabic) {
    return {
      promptType: promptConfig.type,
      promptText: promptConfig.prompt,
      quotes: [],
      validCount: 0,
      totalCount: 0,
      accuracy: 0,
      noArabicContent: true,
    };
  }

  // Validate with quran-validator
  const processor = new LLMProcessor();
  const validated = processor.process(content);

  const quotes: CachedQuote[] = validated.quotes.map((q) => ({
    reference: q.reference || 'unknown',
    expectedReference: promptConfig.expectedRef,
    isValid: q.isValid,
    confidence: q.confidence,
    original: q.original,
    corrected: q.wasCorrected ? q.corrected : undefined,
    invalidReason: determineInvalidReason(q, promptConfig.expectedRef),
    promptType: promptConfig.type,
  }));

  // For specific prompts, check if they quoted the right verse
  if (promptConfig.expectedRef && quotes.length > 0) {
    const expectedText = getExpectedVerseText(promptConfig.expectedRef);
    for (const quote of quotes) {
      // If they claimed a different reference, mark as wrong_reference
      if (quote.reference !== promptConfig.expectedRef && quote.reference !== 'unknown') {
        if (!quote.invalidReason) {
          quote.invalidReason = 'wrong_reference';
          quote.isValid = false;
        }
      }
      // If they didn't provide a reference but we can match the text
      if (quote.reference === 'unknown' && expectedText) {
        // Check if text matches expected
        const processor = new LLMProcessor();
        const validation = processor.validateQuote(quote.original, promptConfig.expectedRef);
        if (validation.isValid) {
          quote.reference = promptConfig.expectedRef;
          quote.isValid = true;
          quote.invalidReason = null;
        }
      }
    }
  }

  const validCount = quotes.filter((q) => q.isValid).length;
  const totalCount = quotes.length;
  const accuracy = totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 0;

  return {
    promptType: promptConfig.type,
    promptText: promptConfig.prompt,
    quotes,
    validCount,
    totalCount,
    accuracy,
    noArabicContent: false,
  };
}

export async function runBenchmark(
  modelId: string,
  modelName: string,
  icon: string,
  forceRefresh = false
): Promise<CachedResult> {
  // Check cache first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = getCachedResult(modelId);
    if (cached) {
      return cached;
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Run all prompts
  const promptResults: PromptResult[] = [];
  for (const promptConfig of TEST_PROMPTS) {
    const result = await runSinglePrompt(modelId, promptConfig, apiKey);
    promptResults.push(result);
  }

  // Aggregate results
  const allQuotes = promptResults.flatMap((r) => r.quotes);
  const totalValid = allQuotes.filter((q) => q.isValid).length;
  const totalQuotes = allQuotes.length;
  const overallAccuracy = totalQuotes > 0 ? Math.round((totalValid / totalQuotes) * 100) : 0;

  // Build error breakdown
  const errorBreakdown: Record<string, number> = {};
  for (const quote of allQuotes) {
    if (quote.invalidReason) {
      errorBreakdown[quote.invalidReason] = (errorBreakdown[quote.invalidReason] || 0) + 1;
    }
  }

  // Track no-response cases
  const noResponseCount = promptResults.filter((r) => r.noArabicContent).length;
  if (noResponseCount > 0) {
    errorBreakdown['no_arabic_content'] = noResponseCount;
  }

  const result: CachedResult = {
    modelId,
    modelName,
    icon,
    timestamp: Date.now(),
    quotes: allQuotes,
    validCount: totalValid,
    totalCount: totalQuotes,
    accuracy: overallAccuracy,
    promptResults,
    errorBreakdown,
  };

  // Cache the result
  setCachedResult(result);

  return result;
}
