/**
 * LLM Integration Module
 *
 * Provides tools for integrating Quran validation into LLM pipelines:
 * 1. System prompts that instruct LLMs to tag Quran quotes
 * 2. Post-processors that validate and correct tagged quotes
 * 3. Scanners that detect untagged potential Quran content
 */

import { QuranValidator } from './validator';

/**
 * Result of processing LLM output for Quran validation
 */
export interface ProcessedOutput {
  /** The corrected output text (with Quran quotes fixed) */
  correctedText: string;
  /** Whether all Quran quotes were valid */
  allValid: boolean;
  /** Details about each detected quote */
  quotes: QuoteAnalysis[];
  /** Warnings about potential issues */
  warnings: string[];
}

/**
 * Analysis of a single Quran quote
 */
export interface QuoteAnalysis {
  /** Original text from the LLM */
  original: string;
  /** Corrected text (if different) */
  corrected: string;
  /** Whether this was valid */
  isValid: boolean;
  /** Reference if identified (e.g., "2:255") */
  reference?: string;
  /** Confidence score */
  confidence: number;
  /** How this quote was detected */
  detectionMethod: 'tagged' | 'contextual' | 'fuzzy';
  /** Position in original text */
  startIndex: number;
  endIndex: number;
  /** Whether correction was applied */
  wasCorrected: boolean;
}

/**
 * Options for the LLM processor
 */
export interface LLMProcessorOptions {
  /** Auto-correct misquoted verses (default: true) */
  autoCorrect?: boolean;
  /** Minimum confidence to consider a fuzzy match valid (default: 0.85) */
  minConfidence?: number;
  /** Include untagged Arabic text in scan (default: true) */
  scanUntagged?: boolean;
  /** Tag format to look for (default: 'xml') */
  tagFormat?: 'xml' | 'markdown' | 'bracket';
}

/**
 * Contextual patterns that suggest Quran quotes
 */
const QURAN_CONTEXT_PATTERNS = [
  // English patterns
  /(?:Allah\s+says?|God\s+says?|the\s+Quran\s+says?|in\s+the\s+Quran|Quranic\s+verse|verse\s+states?|ayah|ayat|surah)\s*[:\-]?\s*/gi,
  // Arabic patterns
  /(?:قال\s+الله|قال\s+تعالى|يقول\s+الله|في\s+القرآن|الآية|سورة)\s*[:\-]?\s*/g,
  // Reference patterns like (2:255) or [Al-Baqarah:255]
  /\(?\d{1,3}:\d{1,3}\)?/g,
  /\[[\w\-]+:\d+\]/g,
];

/**
 * System prompts for LLMs to properly format Quran quotes
 */
export const SYSTEM_PROMPTS = {
  /**
   * XML-style tagging (recommended)
   */
  xml: `When quoting verses from the Quran, you MUST use this exact format:
<quran ref="SURAH:AYAH">ARABIC_TEXT</quran>

Example:
<quran ref="1:1">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</quran>

Rules:
- Always include the reference (surah:ayah number)
- Use the exact Arabic text with full diacritics if possible
- Never paraphrase or partially quote without indication
- If unsure of exact wording, say "approximately" before the quote`,

  /**
   * Markdown-style tagging
   */
  markdown: `When quoting verses from the Quran, use this format:
\`\`\`quran ref="SURAH:AYAH"
ARABIC_TEXT
\`\`\`

Example:
\`\`\`quran ref="112:1"
قُلْ هُوَ ٱللَّهُ أَحَدٌ
\`\`\``,

  /**
   * Bracket-style tagging (simpler)
   */
  bracket: `When quoting Quran verses, use: [[Q:SURAH:AYAH|ARABIC_TEXT]]

Example: [[Q:1:1|بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ]]`,

  /**
   * Minimal instruction (for models that don't follow complex formats)
   */
  minimal: `Always cite Quran verses with their reference number in parentheses immediately after, like: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ (1:1)"`,
};

/**
 * Regex patterns for extracting tagged quotes
 */
const TAG_PATTERNS = {
  xml: /<quran\s+ref=["'](\d+:\d+)["']>([\s\S]*?)<\/quran>/gi,
  markdown: /```quran\s+ref=["'](\d+:\d+)["']\n([\s\S]*?)\n```/gi,
  bracket: /\[\[Q:(\d+:\d+)\|([\s\S]*?)\]\]/gi,
  // Also match inline references like "text (1:1)"
  inlineRef: /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+)\s*\((\d+:\d+)\)/g,
};

/**
 * LLM Output Processor
 *
 * Processes LLM-generated text to validate and correct Quran quotes.
 *
 * @example
 * ```ts
 * const processor = new LLMProcessor();
 *
 * // Add system prompt to your LLM call
 * const systemPrompt = processor.getSystemPrompt();
 *
 * // Process the LLM response
 * const result = processor.process(llmResponse);
 *
 * if (!result.allValid) {
 *   console.log('Corrections needed:', result.quotes.filter(q => q.wasCorrected));
 * }
 *
 * // Use the corrected text
 * console.log(result.correctedText);
 * ```
 */
export class LLMProcessor {
  private validator: QuranValidator;
  private options: Required<LLMProcessorOptions>;

  constructor(options: LLMProcessorOptions = {}) {
    this.validator = new QuranValidator();
    this.options = {
      autoCorrect: options.autoCorrect ?? true,
      minConfidence: options.minConfidence ?? 0.85,
      scanUntagged: options.scanUntagged ?? true,
      tagFormat: options.tagFormat ?? 'xml',
    };
  }

  /**
   * Get the recommended system prompt for the configured tag format
   */
  getSystemPrompt(): string {
    return SYSTEM_PROMPTS[this.options.tagFormat];
  }

  /**
   * Process LLM output to validate and optionally correct Quran quotes
   *
   * @param text - The LLM-generated text
   * @returns Processed output with validation results
   */
  process(text: string): ProcessedOutput {
    const quotes: QuoteAnalysis[] = [];
    const warnings: string[] = [];
    let correctedText = text;

    // Step 1: Extract and validate tagged quotes
    const taggedQuotes = this.extractTaggedQuotes(text);
    for (const tagged of taggedQuotes) {
      const analysis = this.analyzeQuote(
        tagged.text,
        tagged.reference,
        tagged.startIndex,
        tagged.endIndex,
        'tagged'
      );
      quotes.push(analysis);

      if (this.options.autoCorrect && analysis.wasCorrected) {
        correctedText = this.replaceInText(
          correctedText,
          tagged.fullMatch,
          this.formatCorrectedTag(analysis)
        );
      }
    }

    // Step 2: Scan for contextual quotes (preceded by "Allah says", etc.)
    const contextualQuotes = this.extractContextualQuotes(text, taggedQuotes);
    for (const contextual of contextualQuotes) {
      const analysis = this.analyzeQuote(
        contextual.text,
        undefined,
        contextual.startIndex,
        contextual.endIndex,
        'contextual'
      );

      if (analysis.isValid || analysis.confidence >= this.options.minConfidence) {
        quotes.push(analysis);

        if (this.options.autoCorrect && analysis.wasCorrected) {
          correctedText = this.replaceInText(
            correctedText,
            contextual.text,
            analysis.corrected
          );
        }
      }
    }

    // Step 3: Scan for untagged Arabic that might be Quran (fuzzy)
    if (this.options.scanUntagged) {
      const untaggedQuotes = this.scanUntaggedArabic(text, quotes);
      for (const untagged of untaggedQuotes) {
        const analysis = this.analyzeQuote(
          untagged.text,
          undefined,
          untagged.startIndex,
          untagged.endIndex,
          'fuzzy'
        );

        if (analysis.confidence >= this.options.minConfidence) {
          quotes.push(analysis);
          warnings.push(
            `Potential untagged Quran quote detected: "${untagged.text.slice(0, 50)}..." ` +
              `(possibly ${analysis.reference}, ${(analysis.confidence * 100).toFixed(0)}% confidence)`
          );

          if (this.options.autoCorrect && analysis.wasCorrected) {
            correctedText = this.replaceInText(
              correctedText,
              untagged.text,
              analysis.corrected
            );
          }
        }
      }
    }

    // Determine overall validity
    const allValid = quotes.every((q) => q.isValid && !q.wasCorrected);

    return {
      correctedText,
      allValid,
      quotes,
      warnings,
    };
  }

  /**
   * Validate a single quote without full processing
   */
  validateQuote(
    text: string,
    expectedRef?: string
  ): { isValid: boolean; correctText?: string; actualRef?: string } {
    const validation = this.validator.validate(text);

    if (!validation.isValid) {
      return { isValid: false };
    }

    // If expected reference provided, check it matches
    if (expectedRef && validation.reference !== expectedRef) {
      return {
        isValid: false,
        correctText: validation.matchedVerse?.text,
        actualRef: validation.reference,
      };
    }

    // Check if text needs correction
    const needsCorrection =
      validation.matchType !== 'exact' && validation.matchedVerse;

    return {
      isValid: true,
      correctText: needsCorrection ? validation.matchedVerse?.text : undefined,
      actualRef: validation.reference,
    };
  }

  // Private methods

  private extractTaggedQuotes(
    text: string
  ): { text: string; reference: string; startIndex: number; endIndex: number; fullMatch: string }[] {
    const results: {
      text: string;
      reference: string;
      startIndex: number;
      endIndex: number;
      fullMatch: string;
    }[] = [];

    const pattern = TAG_PATTERNS[this.options.tagFormat];
    let match;

    // Reset regex state
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      results.push({
        reference: match[1],
        text: match[2].trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        fullMatch: match[0],
      });
    }

    // Also check for inline references
    TAG_PATTERNS.inlineRef.lastIndex = 0;
    while ((match = TAG_PATTERNS.inlineRef.exec(text)) !== null) {
      // Skip if this overlaps with an already found tagged quote
      const overlaps = results.some(
        (r) => match!.index >= r.startIndex && match!.index < r.endIndex
      );
      if (!overlaps) {
        results.push({
          text: match[1].trim(),
          reference: match[2],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          fullMatch: match[0],
        });
      }
    }

    return results;
  }

  private extractContextualQuotes(
    text: string,
    alreadyFound: { startIndex: number; endIndex: number }[]
  ): { text: string; startIndex: number; endIndex: number }[] {
    const results: { text: string; startIndex: number; endIndex: number }[] = [];

    for (const pattern of QURAN_CONTEXT_PATTERNS) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        // Look for Arabic text following this pattern
        const afterMatch = text.slice(match.index + match[0].length);
        const arabicMatch = afterMatch.match(
          /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]+/
        );

        if (arabicMatch && arabicMatch[0].trim().length >= 10) {
          const startIndex = match.index + match[0].length;
          const endIndex = startIndex + arabicMatch[0].length;

          // Skip if overlaps with already found quotes
          const overlaps = alreadyFound.some(
            (r) =>
              (startIndex >= r.startIndex && startIndex < r.endIndex) ||
              (endIndex > r.startIndex && endIndex <= r.endIndex)
          );

          if (!overlaps) {
            results.push({
              text: arabicMatch[0].trim(),
              startIndex,
              endIndex,
            });
          }
        }
      }
    }

    return results;
  }

  private scanUntaggedArabic(
    text: string,
    alreadyFound: { startIndex: number; endIndex: number }[]
  ): { text: string; startIndex: number; endIndex: number }[] {
    const results: { text: string; startIndex: number; endIndex: number }[] = [];

    // Find all Arabic text segments
    const arabicPattern =
      /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF][\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]*/g;

    let match;
    while ((match = arabicPattern.exec(text)) !== null) {
      const segment = match[0].trim();

      // Skip short segments
      if (segment.length < 15) continue;

      // Skip if overlaps with already found quotes
      const overlaps = alreadyFound.some(
        (r) =>
          (match!.index >= r.startIndex && match!.index < r.endIndex) ||
          (match!.index + match![0].length > r.startIndex &&
            match!.index + match![0].length <= r.endIndex)
      );

      if (!overlaps) {
        results.push({
          text: segment,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    return results;
  }

  private analyzeQuote(
    text: string,
    expectedRef: string | undefined,
    startIndex: number,
    endIndex: number,
    detectionMethod: 'tagged' | 'contextual' | 'fuzzy'
  ): QuoteAnalysis {
    const validation = this.validator.validate(text);

    let isValid = validation.isValid;
    let wasCorrected = false;
    let corrected = text;

    // Check reference if provided
    if (expectedRef && validation.reference && validation.reference !== expectedRef) {
      // Reference mismatch - this might be an error
      isValid = false;
    }

    // Determine if correction is needed
    if (
      validation.isValid &&
      validation.matchType !== 'exact' &&
      validation.matchedVerse
    ) {
      corrected = validation.matchedVerse.text;
      wasCorrected = true;
    }

    return {
      original: text,
      corrected,
      isValid,
      reference: validation.reference,
      confidence: validation.confidence,
      detectionMethod,
      startIndex,
      endIndex,
      wasCorrected,
    };
  }

  private formatCorrectedTag(analysis: QuoteAnalysis): string {
    switch (this.options.tagFormat) {
      case 'xml':
        return `<quran ref="${analysis.reference}">${analysis.corrected}</quran>`;
      case 'markdown':
        return `\`\`\`quran ref="${analysis.reference}"\n${analysis.corrected}\n\`\`\``;
      case 'bracket':
        return `[[Q:${analysis.reference}|${analysis.corrected}]]`;
      default:
        return `${analysis.corrected} (${analysis.reference})`;
    }
  }

  private replaceInText(
    text: string,
    original: string,
    replacement: string
  ): string {
    return text.replace(original, replacement);
  }
}

/**
 * Create an LLM processor instance
 */
export function createLLMProcessor(
  options?: LLMProcessorOptions
): LLMProcessor {
  return new LLMProcessor(options);
}

/**
 * Quick validation of a complete LLM response
 *
 * @param text - LLM output to validate
 * @returns Simple validation result
 */
export function quickValidate(text: string): {
  hasQuranContent: boolean;
  allValid: boolean;
  issues: string[];
} {
  const processor = new LLMProcessor({ autoCorrect: false });
  const result = processor.process(text);

  return {
    hasQuranContent: result.quotes.length > 0,
    allValid: result.allValid,
    issues: [
      ...result.quotes
        .filter((q) => !q.isValid || q.wasCorrected)
        .map(
          (q) =>
            `Quote "${q.original.slice(0, 30)}..." is ${
              q.isValid ? 'imprecise' : 'invalid'
            }` + (q.reference ? ` (should be ${q.reference})` : '')
        ),
      ...result.warnings,
    ],
  };
}
