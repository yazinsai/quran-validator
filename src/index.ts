/**
 * quran-validator
 *
 * Validate and verify Quranic verses in LLM-generated text with 100% accuracy.
 *
 * @packageDocumentation
 *
 * @example Basic Validation
 * ```ts
 * import { QuranValidator } from 'quran-validator';
 *
 * const validator = new QuranValidator();
 *
 * // Validate a specific quote
 * const result = validator.validate("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");
 * console.log(result.isValid); // true
 * console.log(result.reference); // "1:1"
 * ```
 *
 * @example LLM Integration (Recommended)
 * ```ts
 * import { LLMProcessor, SYSTEM_PROMPTS } from 'quran-validator';
 *
 * // 1. Add system prompt to your LLM
 * const systemPrompt = SYSTEM_PROMPTS.xml;
 *
 * // 2. Process LLM response
 * const processor = new LLMProcessor();
 * const result = processor.process(llmResponse);
 *
 * // 3. Use corrected text
 * console.log(result.correctedText);
 * console.log(result.allValid); // true if all quotes are authentic
 * ```
 */

// Main validator
export { QuranValidator, createValidator } from './validator';

// LLM Integration (recommended for processing LLM output)
export {
  LLMProcessor,
  createLLMProcessor,
  quickValidate,
  SYSTEM_PROMPTS,
} from './llm-integration';

// Normalization utilities
export {
  normalizeArabic,
  removeDiacritics,
  containsArabic,
  extractArabicSegments,
  calculateSimilarity,
  findDifferences,
} from './normalizer';

export type { NormalizeOptions } from './normalizer';

// Types
export type {
  QuranVerse,
  QuranSurah,
  ValidationResult,
  DetectionResult,
  ValidatorOptions,
  MatchType,
  FabricationAnalysis,
  WordAnalysis,
  RiwayaId,
  RiwayaInfo,
  RiwayaMatch,
} from './types';

export type {
  ProcessedOutput,
  QuoteAnalysis,
  LLMProcessorOptions,
} from './llm-integration';
