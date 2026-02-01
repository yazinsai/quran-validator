# quran-validator

Validate and verify Quranic verses in LLM-generated text with high accuracy.

[![npm version](https://badge.fury.io/js/quran-validator.svg)](https://www.npmjs.com/package/quran-validator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Verse Validation**: Validate any Arabic text against the authoritative Quran database
- **Multi-tier Matching**: Exact → Normalized → Partial → Fuzzy matching for maximum accuracy
- **Arabic Text Normalization**: Handles diacritics, alef variants, alef-wasla, and more
- **LLM Integration**: Designed for post-processing LLM output to verify Quranic quotes
- **Correction Suggestions**: Get the correct verse when a quote has errors
- **Full Quran Database**: Includes all 6,236 verses (Uthmani script)
- **Zero Dependencies**: Fully self-contained with bundled data
- **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install quran-validator
# or
pnpm add quran-validator
# or
yarn add quran-validator
```

## Quick Start

```typescript
import { QuranValidator } from 'quran-validator';

const validator = new QuranValidator();

// Validate a Quran quote
const result = validator.validate('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');

console.log(result.isValid);     // true
console.log(result.reference);   // "1:1"
console.log(result.matchType);   // "exact"
console.log(result.confidence);  // 1.0
```

## API

### `QuranValidator`

The main class for validating Quranic text.

```typescript
const validator = new QuranValidator(options?: ValidatorOptions);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fuzzyThreshold` | `number` | `0.8` | Minimum confidence for fuzzy matches (0-1) |
| `maxSuggestions` | `number` | `3` | Maximum number of suggestions to return |
| `includePartial` | `boolean` | `true` | Whether to include partial matches |
| `minDetectionLength` | `number` | `10` | Minimum text length for detection |

### Methods

#### `validate(text: string): ValidationResult`

Validate a potential Quran quote.

```typescript
const result = validator.validate('قُلْ هُوَ ٱللَّهُ أَحَدٌ');

// Result:
{
  isValid: true,
  matchType: 'exact',    // 'exact' | 'normalized' | 'partial' | 'fuzzy' | 'none'
  confidence: 1.0,       // 0-1
  reference: '112:1',    // surah:ayah
  matchedVerse: { ... }, // Full verse object
  differences: [],       // Corrections if not exact match
  suggestions: []        // Alternative matches
}
```

#### `detectAndValidate(text: string): DetectionResult`

Detect and validate all Quran quotes in mixed text. Perfect for LLM output processing.

```typescript
const llmOutput = 'The verse بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ means...';
const result = validator.detectAndValidate(llmOutput);

// Result:
{
  detected: true,
  segments: [
    {
      text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      startIndex: 10,
      endIndex: 42,
      validation: { isValid: true, reference: '1:1', ... }
    }
  ]
}
```

#### `getVerse(surah: number, ayah: number): QuranVerse | undefined`

Get a verse by reference.

```typescript
const verse = validator.getVerse(2, 255); // Ayat al-Kursi
console.log(verse?.text);
```

#### `getSurah(surahNumber: number): QuranSurah | undefined`

Get surah information.

```typescript
const surah = validator.getSurah(1);
console.log(surah?.englishName); // "Al-Faatiha"
console.log(surah?.versesCount); // 7
```

#### `search(query: string, limit?: number): SearchResult[]`

Search for verses by text.

```typescript
const results = validator.search('الرحمن الرحيم', 5);
for (const { verse, similarity } of results) {
  console.log(`${verse.surah}:${verse.ayah} - ${similarity}`);
}
```

### Normalization Utilities

These functions are exported for advanced use cases:

```typescript
import {
  normalizeArabic,
  removeDiacritics,
  containsArabic,
  extractArabicSegments,
  calculateSimilarity,
} from 'quran-validator';

// Normalize Arabic text for comparison
normalizeArabic('السَّلَامُ عَلَيْكُمُ'); // 'السلام عليكم'

// Remove only diacritics
removeDiacritics('بِسْمِ اللَّهِ'); // 'بسم الله'

// Check if text contains Arabic
containsArabic('Hello مرحبا world'); // true

// Extract Arabic segments from mixed text
extractArabicSegments('Say بسم الله and continue');
// [{ text: 'بسم الله', startIndex: 4, endIndex: 12 }]
```

## Use Cases

### LLM Post-Processing

Validate Quran quotes in AI-generated content:

```typescript
async function validateLLMResponse(response: string) {
  const validator = new QuranValidator();
  const detection = validator.detectAndValidate(response);

  for (const segment of detection.segments) {
    if (!segment.validation?.isValid) {
      console.warn(`Potential misquote: "${segment.text}"`);
    } else if (segment.validation.matchType !== 'exact') {
      console.warn(`Imprecise quote at ${segment.validation.reference}`);
      console.log(`Correct: ${segment.validation.matchedVerse?.text}`);
    }
  }

  return detection;
}
```

### Content Verification

Check articles or documents for Quran citation accuracy:

```typescript
function verifyQuranCitations(document: string) {
  const validator = new QuranValidator();
  const issues: string[] = [];

  const detection = validator.detectAndValidate(document);

  for (const segment of detection.segments) {
    const v = segment.validation;

    if (!v?.isValid) {
      issues.push(`Unverified Arabic text: "${segment.text}"`);
    } else if (v.matchType === 'fuzzy') {
      issues.push(
        `Low confidence match (${(v.confidence * 100).toFixed(0)}%) ` +
        `for ${v.reference}: "${segment.text}"`
      );
    }
  }

  return issues;
}
```

### Arabic Text Processing

```typescript
import { normalizeArabic } from 'quran-validator';

// Normalize user input for search
function searchQuran(userInput: string) {
  const validator = new QuranValidator();
  const normalized = normalizeArabic(userInput);
  return validator.search(normalized);
}
```

## Match Types

| Type | Description | Confidence |
|------|-------------|------------|
| `exact` | Perfect character-by-character match | 1.0 |
| `normalized` | Match after removing diacritics and normalizing alef | ~0.95 |
| `partial` | Input is part of a verse or vice versa | 0.7-0.9 |
| `fuzzy` | Similar but not exact match (Levenshtein-based) | 0.8+ |
| `none` | No match found | 0 |

## Normalization Rules

The library applies these normalizations for matching:

1. **Remove diacritics** (tashkeel): ـَ ـِ ـُ ـْ ـّ etc.
2. **Normalize alef variants**: أ إ آ ٱ → ا
3. **Normalize alef maqsura**: ى → ي
4. **Normalize teh marbuta**: ة → ه
5. **Remove tatweel**: ـ
6. **Normalize hamza carriers**: ؤ → و, ئ → ي
7. **Normalize whitespace**: multiple spaces → single space

## Data Source

This library uses the [AlQuran.cloud API](https://alquran.cloud/api) Uthmani text, which is based on the authoritative Medina Mushaf (1924 Cairo edition, Al-Azhar endorsed).

- **Total Verses**: 6,236
- **Total Surahs**: 114
- **Script**: Uthmani
- **Encoding**: UTF-8

## License

MIT © Yazin Alirhayim

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
