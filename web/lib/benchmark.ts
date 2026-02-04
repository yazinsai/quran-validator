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
  // Single verse: "2:255"
  const singleMatch = ref.match(/^(\d+):(\d+)$/);
  if (singleMatch) {
    const surah = parseInt(singleMatch[1], 10);
    const ayah = parseInt(singleMatch[2], 10);
    return validator.getVerse(surah, ayah) !== undefined;
  }

  // Verse range: "107:1-7"
  const rangeMatch = ref.match(/^(\d+):(\d+)-(\d+)$/);
  if (rangeMatch) {
    const surah = parseInt(rangeMatch[1], 10);
    const startAyah = parseInt(rangeMatch[2], 10);
    const endAyah = parseInt(rangeMatch[3], 10);
    return validator.getVerseRange(surah, startAyah, endAyah) !== undefined;
  }

  return false;
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
    reference?: string;
    normalizedInput?: string;
    expectedNormalized?: string;
  },
  expectedRef?: string
): InvalidReason {
  // If the validator says it's valid, trust it
  if (quote.isValid) {
    // Check for wrong reference (valid verse, wrong citation)
    if (expectedRef && quote.reference && quote.reference !== expectedRef) {
      return 'wrong_reference';
    }
    // wasCorrected means diacritics/normalization differences - still valid
    if (quote.wasCorrected) {
      return 'diacritics_error';
    }
    // Perfect match
    return null;
  }

  // isValid: false - text doesn't match the cited verse
  // Check if cited reference doesn't exist at all
  if (quote.reference && quote.reference !== 'unknown' && !isValidReference(quote.reference)) {
    return 'invalid_reference';
  }

  const normalizedInput = quote.normalizedInput?.trim();
  const expectedNormalized = quote.expectedNormalized?.trim();

  if (normalizedInput && expectedNormalized) {
    if (expectedNormalized.includes(normalizedInput) && normalizedInput.length < expectedNormalized.length) {
      return 'truncated';
    }

    const inputWords = normalizedInput.split(/\s+/);
    const expectedWords = new Set(expectedNormalized.split(/\s+/));
    const overlapCount = inputWords.filter((w) => expectedWords.has(w)).length;
    const overlapRatio = inputWords.length > 0 ? overlapCount / inputWords.length : 0;

    if (inputWords.length >= 4 && overlapRatio >= 0.6) {
      return 'hallucinated_words';
    }
  }

  // Text doesn't match the cited verse - it's fabricated
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
      rawResponse: content,
    };
  }

  // Validate with quran-validator
  const processor = new LLMProcessor();
  const validated = processor.process(content);

  // Get the expected verse text if we have an expected reference
  const expectedVerseText = promptConfig.expectedRef
    ? getExpectedVerseText(promptConfig.expectedRef)
    : null;

  const quotes: CachedQuote[] = validated.quotes.map((q) => ({
    reference: q.reference || 'unknown',
    expectedReference: promptConfig.expectedRef,
    isValid: q.isValid,
    original: q.original,
    // For specific prompts, show the full expected verse; otherwise show validator's correction
    corrected: promptConfig.expectedRef && expectedVerseText && !q.isValid
      ? expectedVerseText
      : (q.wasCorrected ? q.corrected : undefined),
    invalidReason: determineInvalidReason(
      {
        ...q,
        normalizedInput: q.normalizedInput,
        expectedNormalized: q.expectedNormalized,
      },
      promptConfig.expectedRef
    ),
    promptType: promptConfig.type,
    normalizedInput: q.normalizedInput,
    expectedNormalized: q.expectedNormalized,
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
    rawResponse: content,
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
