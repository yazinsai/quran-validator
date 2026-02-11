import { NormalizeOptions } from 'arabic-text-normalizer';
export { NormalizeOptions } from 'arabic-text-normalizer';

/**
 * Represents a single verse (ayah) from the Quran
 */
interface QuranVerse {
    /** Sequential verse number (1-6236) */
    id: number;
    /** Surah (chapter) number (1-114) */
    surah: number;
    /** Ayah (verse) number within the surah */
    ayah: number;
    /** Full Arabic text with diacritics (Uthmani script) */
    text: string;
    /** Simplified Arabic text without diacritics */
    textSimple: string;
    /** Page number in standard Uthmani mushaf */
    page: number;
    /** Juz (part) number (1-30) */
    juz: number;
}
/**
 * Represents a Surah (chapter) of the Quran
 */
interface QuranSurah {
    /** Surah number (1-114) */
    number: number;
    /** Arabic name of the surah */
    name: string;
    /** English name of the surah */
    englishName: string;
    /** Number of verses in this surah */
    versesCount: number;
    /** Revelation type: 'Meccan' or 'Medinan' */
    revelationType: 'Meccan' | 'Medinan';
}
/**
 * Type of match found during validation
 */
type MatchType = 'exact' | 'normalized' | 'none';
/**
 * Result of validating a potential Quran quote
 */
interface ValidationResult {
    /** Whether a valid Quran verse was found */
    isValid: boolean;
    /** Type of match found */
    matchType: MatchType;
    /** The matched verse (if found) */
    matchedVerse?: QuranVerse;
    /** Reference string like "2:255" */
    reference?: string;
    /** The normalized (stripped) input text that was checked */
    normalizedInput?: string;
    /** The expected normalized verse text (for comparison when invalid) */
    expectedNormalized?: string;
    /** Character index where the mismatch starts (-1 if no mismatch or different lengths) */
    mismatchIndex?: number;
    /** Suggestions if multiple possible matches exist */
    suggestions?: {
        verse: QuranVerse;
        reference: string;
    }[];
    /** All matching riwayat, best match first (only present when multiple riwayat loaded) */
    riwayaMatches?: RiwayaMatch[];
}
/**
 * Detection result for finding Quran quotes in text
 */
interface DetectionResult {
    /** Whether potential Quran content was detected */
    detected: boolean;
    /** Extracted segments that appear to be Quran quotes */
    segments: {
        /** The detected text */
        text: string;
        /** Start position in original text */
        startIndex: number;
        /** End position in original text */
        endIndex: number;
        /** Validation result for this segment */
        validation?: ValidationResult;
    }[];
}
/**
 * Supported riwaya identifiers
 */
type RiwayaId = 'hafs' | 'warsh' | 'qalun' | 'shuba' | 'duri' | 'susi' | 'bazzi' | 'qunbul';
/**
 * Metadata about a riwaya (transmission of Quran recitation)
 */
interface RiwayaInfo {
    id: RiwayaId;
    name: string;
    nameArabic: string;
    qari: string;
    qariArabic: string;
}
/**
 * A match from a specific riwaya
 */
interface RiwayaMatch {
    riwaya: RiwayaId;
    matchType: MatchType;
    verse: QuranVerse;
    riwayaText: string;
}
/**
 * Options for the validator
 */
interface ValidatorOptions {
    /** Maximum number of suggestions to return (default: 3) */
    maxSuggestions?: number;
    /** Minimum text length to consider for detection (default: 10) */
    minDetectionLength?: number;
    /** Which riwayat to load (default: ['hafs']) */
    riwayat?: RiwayaId[];
}
/**
 * Analysis of word-level fabrication in text
 */
interface FabricationAnalysis {
    /** The normalized text that was analyzed */
    normalizedInput: string;
    /** Word-by-word breakdown */
    words: WordAnalysis[];
    /** Summary stats */
    stats: {
        totalWords: number;
        fabricatedWords: number;
        /** Ratio of fabricated words (0-1) */
        fabricatedRatio: number;
    };
}
/**
 * Analysis of a single word
 */
interface WordAnalysis {
    /** The normalized word */
    word: string;
    /** True if this word doesn't exist anywhere in the Quran */
    isFabricated: boolean;
}

/**
 * QuranValidator - Validate and verify Quranic verses in text
 *
 * @example
 * ```ts
 * import { QuranValidator } from 'quran-validator';
 *
 * const validator = new QuranValidator();
 *
 * // Validate a specific quote
 * const result = validator.validate("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ");
 * console.log(result.isValid); // true
 * console.log(result.reference); // "1:1"
 *
 * // Detect and validate all Quran quotes in text
 * const detection = validator.detectAndValidate(llmOutput);
 * for (const segment of detection.segments) {
 *   console.log(segment.text, segment.validation?.isValid);
 * }
 * ```
 */
declare class QuranValidator {
    private verses;
    private surahs;
    private options;
    private normalizedVerseMap;
    private verseById;
    private exactTextMap;
    private normalizedRiwayaMap;
    private riwayaVerses;
    private loadedRiwayat;
    private multiRiwaya;
    private normalizedCorpus;
    constructor(options?: ValidatorOptions);
    /**
     * Validate a potential Quran quote
     *
     * @param text - The Arabic text to validate
     * @returns Validation result with match details
     *
     * @example
     * ```ts
     * const result = validator.validate("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ");
     * if (result.isValid) {
     *   console.log(`Found: ${result.reference}`); // "1:1"
     *   console.log(`Match type: ${result.matchType}`); // "exact"
     * }
     * ```
     */
    validate(text: string): ValidationResult;
    /**
     * Validate text against a specific verse reference
     *
     * @param text - The Arabic text to validate
     * @param reference - The expected verse reference (e.g., "1:1" or "2:255-257")
     * @returns Validation result with diff information
     *
     * @example
     * ```ts
     * const result = validator.validateAgainst("بسم الله", "1:1");
     * if (!result.isValid) {
     *   console.log(`Expected: ${result.expectedNormalized}`);
     *   console.log(`Got: ${result.normalizedInput}`);
     *   console.log(`Mismatch at index: ${result.mismatchIndex}`);
     * }
     * ```
     */
    validateAgainst(text: string, reference: string): ValidationResult;
    /**
     * Detect and validate all potential Quran quotes in text
     *
     * This is useful for post-processing LLM output to find and verify
     * any Quranic content.
     *
     * @param text - Text that may contain Quran quotes
     * @returns Detection result with validated segments
     *
     * @example
     * ```ts
     * const llmOutput = "The verse بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ means...";
     * const result = validator.detectAndValidate(llmOutput);
     *
     * for (const segment of result.segments) {
     *   if (segment.validation?.isValid) {
     *     console.log(`Valid quote: ${segment.text}`);
     *   } else {
     *     console.log(`Possible misquote: ${segment.text}`);
     *   }
     * }
     * ```
     */
    detectAndValidate(text: string): DetectionResult;
    /**
     * Get a verse by reference (surah:ayah)
     *
     * @param surah - Surah number (1-114)
     * @param ayah - Ayah number
     * @returns The verse or undefined if not found
     */
    getVerse(surah: number, ayah: number): QuranVerse | undefined;
    /**
     * Get a range of verses and concatenate their text
     *
     * @param surah - Surah number (1-114)
     * @param startAyah - Starting ayah number
     * @param endAyah - Ending ayah number
     * @returns Object with concatenated text and verses array, or undefined if invalid range
     */
    getVerseRange(surah: number, startAyah: number, endAyah: number): {
        text: string;
        textSimple: string;
        verses: QuranVerse[];
    } | undefined;
    /**
     * Get all verses in a surah
     *
     * @param surahNumber - Surah number (1-114)
     * @returns Array of verses in the surah
     */
    getSurahVerses(surahNumber: number): QuranVerse[];
    /**
     * Get surah information
     *
     * @param surahNumber - Surah number (1-114)
     * @returns Surah info or undefined
     */
    getSurah(surahNumber: number): QuranSurah | undefined;
    /**
     * Get all surahs
     */
    getAllSurahs(): QuranSurah[];
    /**
     * Search verses by text (containment-based matching)
     *
     * @param query - Search query (Arabic text)
     * @param limit - Maximum results to return
     * @returns Matching verses sorted by relevance
     */
    search(query: string, limit?: number): {
        verse: QuranVerse;
        similarity: number;
    }[];
    /**
     * Analyze text for fabricated words that don't exist in the Quran
     *
     * Uses greedy longest contiguous match algorithm:
     * - Words that exist as part of any contiguous sequence in the Quran are valid
     * - Words that cannot be found anywhere in the Quran corpus are marked as fabricated
     *
     * @param text - The Arabic text to analyze
     * @returns Analysis with word-by-word breakdown
     *
     * @example
     * ```ts
     * const analysis = validator.analyzeFabrication('بسم الله الفلان');
     * // 'بسم' and 'الله' are valid (exist in Quran)
     * // 'الفلان' is fabricated (doesn't exist anywhere)
     * console.log(analysis.stats.fabricatedWords); // 1
     * ```
     */
    analyzeFabrication(text: string): FabricationAnalysis;
    /**
     * Get metadata for all loaded riwayat
     *
     * @returns Array of RiwayaInfo for each loaded riwaya
     */
    getLoadedRiwayat(): RiwayaInfo[];
    /**
     * Get verse texts across all loaded riwayat for a given reference
     *
     * @param surah - Surah number (1-114)
     * @param ayah - Ayah number
     * @returns Array of {riwayaId, text} for each loaded riwaya that has this verse
     */
    getVerseRiwayat(surah: number, ayah: number): {
        riwayaId: RiwayaId;
        text: string;
    }[];
    private validateMultiRiwaya;
    /**
     * Find riwaya matches for a specific reference (surah:ayah)
     */
    private findRiwayaMatchesForRef;
    private findExactMatch;
    private createResult;
    private noMatch;
    /**
     * Find the character index where two strings first differ
     */
    private findMismatchIndex;
}
/**
 * Create a new QuranValidator instance
 *
 * @param options - Validator options
 * @returns QuranValidator instance
 *
 * @example
 * ```ts
 * import { createValidator } from 'quran-validator';
 *
 * const validator = createValidator();
 * ```
 */
declare function createValidator(options?: ValidatorOptions): QuranValidator;

/**
 * LLM Integration Module
 *
 * Provides tools for integrating Quran validation into LLM pipelines:
 * 1. System prompts that instruct LLMs to tag Quran quotes
 * 2. Post-processors that validate and correct tagged quotes
 * 3. Scanners that detect untagged potential Quran content
 */

/**
 * Result of processing LLM output for Quran validation
 */
interface ProcessedOutput {
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
interface QuoteAnalysis {
    /** Original text from the LLM */
    original: string;
    /** Corrected text (if different) */
    corrected: string;
    /** Whether this was valid */
    isValid: boolean;
    /** Reference if identified (e.g., "2:255") */
    reference?: string;
    /** How this quote was detected */
    detectionMethod: 'tagged' | 'contextual' | 'fuzzy';
    /** Position in original text */
    startIndex: number;
    endIndex: number;
    /** Whether correction was applied */
    wasCorrected: boolean;
    /** Normalized input text for debugging */
    normalizedInput?: string;
    /** Expected normalized text when validation fails */
    expectedNormalized?: string;
    /** Word-level fabrication analysis (only for invalid quotes) */
    fabricationAnalysis?: FabricationAnalysis;
}
/**
 * Options for the LLM processor
 */
interface LLMProcessorOptions {
    /** Auto-correct misquoted verses (default: true) */
    autoCorrect?: boolean;
    /** Include untagged Arabic text in scan (default: true) */
    scanUntagged?: boolean;
    /** Tag format to look for (default: 'xml') */
    tagFormat?: 'xml' | 'markdown' | 'bracket';
    /** Which riwayat to load for validation (default: ['hafs']) */
    riwayat?: RiwayaId[];
}
/**
 * System prompts for LLMs to properly format Quran quotes
 */
declare const SYSTEM_PROMPTS: {
    /**
     * XML-style tagging (recommended)
     */
    xml: string;
    /**
     * Markdown-style tagging
     */
    markdown: string;
    /**
     * Bracket-style tagging (simpler)
     */
    bracket: string;
    /**
     * Minimal instruction (for models that don't follow complex formats)
     */
    minimal: string;
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
declare class LLMProcessor {
    private validator;
    private options;
    constructor(options?: LLMProcessorOptions);
    /**
     * Get the recommended system prompt for the configured tag format
     */
    getSystemPrompt(): string;
    /**
     * Process LLM output to validate and optionally correct Quran quotes
     *
     * @param text - The LLM-generated text
     * @returns Processed output with validation results
     */
    process(text: string): ProcessedOutput;
    /**
     * Validate a single quote without full processing
     */
    validateQuote(text: string, expectedRef?: string): {
        isValid: boolean;
        correctText?: string;
        actualRef?: string;
    };
    private extractTaggedQuotes;
    private extractContextualQuotes;
    private scanUntaggedArabic;
    private analyzeQuote;
    /**
     * Analyze a quote that references a verse range (e.g., 107:1-3)
     */
    private analyzeRangeQuote;
    private formatCorrectedTag;
    private replaceInText;
}
/**
 * Create an LLM processor instance
 */
declare function createLLMProcessor(options?: LLMProcessorOptions): LLMProcessor;
/**
 * Quick validation of a complete LLM response
 *
 * @param text - LLM output to validate
 * @returns Simple validation result
 */
declare function quickValidate(text: string): {
    hasQuranContent: boolean;
    allValid: boolean;
    issues: string[];
};

/**
 * Normalize Arabic text for comparison
 *
 * Uses arabic-text-normalizer for core normalization, with additional
 * NFKC decomposition and bidi control stripping.
 *
 * @param text - The Arabic text to normalize
 * @param options - Normalization options (passed to arabic-text-normalizer)
 * @returns Normalized text
 *
 * @example
 * ```ts
 * normalizeArabic("بِسْمِ اللَّهِ") // returns "بسم الله"
 * normalizeArabic("الرَّحْمَٰنِ") // returns "الرحمان"
 * ```
 */
declare function normalizeArabic(text: string, options?: NormalizeOptions): string;
/**
 * Remove only diacritics (tashkeel) from Arabic text
 *
 * This preserves the base letters but removes vowel marks,
 * shadda, sukun, and other diacritical marks.
 *
 * @param text - The Arabic text
 * @returns Text without diacritics
 *
 * @example
 * ```ts
 * removeDiacritics("السَّلَامُ عَلَيْكُمُ") // returns "السلام عليكم"
 * ```
 */
declare function removeDiacritics(text: string): string;
/**
 * Check if text contains Arabic characters
 *
 * @param text - The text to check
 * @returns True if text contains Arabic characters
 */
declare function containsArabic(text: string): boolean;
/**
 * Extract Arabic text segments from mixed text
 *
 * @param text - Text that may contain Arabic and non-Arabic content
 * @returns Array of Arabic text segments with their positions
 */
declare function extractArabicSegments(text: string): {
    text: string;
    startIndex: number;
    endIndex: number;
}[];
/**
 * Calculate similarity between two strings using Levenshtein distance
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score between 0 and 1 (1 = identical)
 */
declare function calculateSimilarity(str1: string, str2: string): number;
/**
 * Find differences between two strings
 *
 * @param input - The input string
 * @param correct - The correct string
 * @returns Array of differences with positions
 */
declare function findDifferences(input: string, correct: string): {
    input: string;
    correct: string;
    position: number;
}[];

export { type DetectionResult, type FabricationAnalysis, LLMProcessor, type LLMProcessorOptions, type MatchType, type ProcessedOutput, type QuoteAnalysis, type QuranSurah, QuranValidator, type QuranVerse, type RiwayaId, type RiwayaInfo, type RiwayaMatch, SYSTEM_PROMPTS, type ValidationResult, type ValidatorOptions, type WordAnalysis, calculateSimilarity, containsArabic, createLLMProcessor, createValidator, extractArabicSegments, findDifferences, normalizeArabic, quickValidate, removeDiacritics };
