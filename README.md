# quran-validator

Validate and verify Quranic verses in LLM-generated text with high accuracy.

[![npm version](https://badge.fury.io/js/quran-validator.svg)](https://www.npmjs.com/package/quran-validator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem

LLMs can misquote Quranic verses - sometimes subtly changing words, missing diacritics, or combining verses incorrectly. For Islamic content, this is unacceptable. This library provides:

1. **System prompts** that instruct LLMs to tag Quran quotes in a parseable format
2. **Post-processing** that validates tagged quotes against the authentic Quran database
3. **Auto-correction** that fixes misquotes to the authentic text
4. **Detection** of untagged Arabic text that might be Quran verses

## Features

- **LLM Integration**: System prompts + post-processor for complete LLM pipelines
- **Multi-tier Matching**: Exact → Normalized → Partial → Fuzzy matching
- **Auto-Correction**: Automatically fix misquoted verses
- **Arabic Normalization**: Handles diacritics, alef variants, alef-wasla, and more
- **Full Quran Database**: All 6,236 verses (Uthmani script) bundled
- **Zero Dependencies**: Fully self-contained
- **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install quran-validator
# or
pnpm add quran-validator
# or
yarn add quran-validator
```

## Quick Start: LLM Integration (Recommended)

### Step 1: Add System Prompt to Your LLM

```typescript
import { SYSTEM_PROMPTS } from 'quran-validator';

// Add this to your LLM's system prompt
const systemPrompt = `
${SYSTEM_PROMPTS.xml}

${yourOtherInstructions}
`;

// The LLM will now output Quran quotes like:
// <quran ref="1:1">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</quran>
```

### Step 2: Process LLM Response

```typescript
import { LLMProcessor } from 'quran-validator';

const processor = new LLMProcessor();

// Process the LLM's response
const result = processor.process(llmResponse);

// Check if all quotes are valid
if (!result.allValid) {
  console.log('Some quotes need attention:', result.quotes.filter(q => !q.isValid));
}

// Use the corrected text (misquotes auto-fixed)
console.log(result.correctedText);

// See all detected quotes
for (const quote of result.quotes) {
  console.log(`${quote.reference}: ${quote.isValid ? '✓' : '✗'} (${quote.detectionMethod})`);
}
```

### Step 3: Handle Warnings

```typescript
// Warnings about potential untagged Quran content
for (const warning of result.warnings) {
  console.warn(warning);
  // e.g., "Potential untagged Quran quote detected: قُلْ هُوَ... (possibly 112:1, 92% confidence)"
}
```

## Verse Range Support

The library supports verse ranges for quoting multiple consecutive verses:

```typescript
// Single verse
<quran ref="1:1">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</quran>

// Verse range (e.g., Surah Al-Ikhlas 112:1-4)
<quran ref="112:1-4">قُلْ هُوَ ٱللَّهُ أَحَدٌ ٱللَّهُ ٱلصَّمَدُ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ</quran>
```

You can also look up verse ranges programmatically:

```typescript
const validator = new QuranValidator();
const range = validator.getVerseRange(112, 1, 4); // Surah 112, verses 1-4

console.log(range.text);   // Concatenated Arabic text
console.log(range.verses); // Array of 4 QuranVerse objects
```

## System Prompt Formats

The library supports multiple tagging formats:

### XML (Recommended)
```typescript
SYSTEM_PROMPTS.xml
// LLM outputs: <quran ref="1:1">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</quran>
// Or for ranges: <quran ref="112:1-4">...</quran>
```

### Markdown
```typescript
SYSTEM_PROMPTS.markdown
// LLM outputs:
// ```quran ref="1:1"
// بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
// ```
```

### Bracket
```typescript
SYSTEM_PROMPTS.bracket
// LLM outputs: [[Q:1:1|بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ]]
```

### Minimal (for models that don't follow complex formats)
```typescript
SYSTEM_PROMPTS.minimal
// LLM outputs: بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ (1:1)
```

## LLMProcessor Options

```typescript
const processor = new LLMProcessor({
  autoCorrect: true,      // Auto-fix misquoted verses (default: true)
  minConfidence: 0.85,    // Minimum confidence for fuzzy matches (default: 0.85)
  scanUntagged: true,     // Scan for untagged potential Quran (default: true)
  tagFormat: 'xml',       // 'xml' | 'markdown' | 'bracket' (default: 'xml')
});
```

## Quick Validation

For simple use cases:

```typescript
import { quickValidate } from 'quran-validator';

const result = quickValidate(llmResponse);

console.log(result.hasQuranContent);  // true if Quran quotes detected
console.log(result.allValid);         // true if all quotes are authentic
console.log(result.issues);           // Array of issues found
```

## Direct Validation API

For validating specific text without the full LLM pipeline:

```typescript
import { QuranValidator } from 'quran-validator';

const validator = new QuranValidator();

// Validate a specific quote
const result = validator.validate('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');

console.log(result.isValid);     // true
console.log(result.reference);   // "1:1"
console.log(result.matchType);   // "exact" | "normalized" | "partial" | "fuzzy" | "none"
console.log(result.confidence);  // 0-1

// Get corrections if needed
if (result.matchType !== 'exact' && result.matchedVerse) {
  console.log('Correct text:', result.matchedVerse.text);
}
```

## Detection Methods

The processor uses three methods to find Quran quotes:

| Method | Description | When Used |
|--------|-------------|-----------|
| `tagged` | Explicitly tagged with XML/markdown/bracket | Always checked first |
| `contextual` | Found after phrases like "Allah says", "in the Quran" | After tagged quotes |
| `fuzzy` | Untagged Arabic text matching Quran verses | If `scanUntagged: true` |

## Match Types

| Type | Description | Confidence |
|------|-------------|------------|
| `exact` | Perfect character-by-character match | 1.0 |
| `normalized` | Match after removing diacritics | ~0.95 |
| `partial` | Input is part of a verse or vice versa | 0.7-0.9 |
| `fuzzy` | Similar but not exact (Levenshtein) | 0.8+ |
| `none` | No match found | 0 |

## Utility Functions

### Verse Lookup

```typescript
// Get specific verse
const verse = validator.getVerse(2, 255); // Ayat al-Kursi
console.log(verse?.text);

// Get surah info
const surah = validator.getSurah(1);
console.log(surah?.englishName); // "Al-Faatiha"
console.log(surah?.versesCount); // 7

// Search verses
const results = validator.search('الرحمن الرحيم', 5);
```

### Arabic Text Processing

```typescript
import {
  normalizeArabic,
  removeDiacritics,
  containsArabic,
  extractArabicSegments,
} from 'quran-validator';

// Normalize for comparison
normalizeArabic('السَّلَامُ عَلَيْكُمُ'); // 'السلام عليكم'

// Remove diacritics only
removeDiacritics('بِسْمِ اللَّهِ'); // 'بسم الله'

// Check for Arabic
containsArabic('Hello مرحبا world'); // true

// Extract Arabic segments
extractArabicSegments('Say بسم الله and continue');
// [{ text: 'بسم الله', startIndex: 4, endIndex: 12 }]
```

## Real-World Example

```typescript
import { LLMProcessor, SYSTEM_PROMPTS } from 'quran-validator';

// Your LLM call
async function askAboutQuran(question: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are an Islamic scholar. ${SYSTEM_PROMPTS.xml}`
      },
      { role: 'user', content: question }
    ]
  });

  // Validate and correct the response
  const processor = new LLMProcessor();
  const validated = processor.process(response.choices[0].message.content);

  if (!validated.allValid) {
    console.warn('Response contained inaccurate Quran quotes');
    // Log for review or regenerate
  }

  return validated.correctedText;
}
```

## Data Source

This library uses high-quality Quranic data from **[QUL (Quranic Universal Library)](https://qul.tarteel.ai/)** by **[Tarteel AI](https://tarteel.ai/)**:

- **Uthmani Script**: Authoritative Arabic text with full diacritics (for corrections)
- **Imlaei Simple**: Simplified phonetic Arabic (for matching/search)

| | |
|---|---|
| **Total Verses** | 6,236 |
| **Total Surahs** | 114 |
| **Uthmani Source** | QUL - Uthmani (Ayah by Ayah) |
| **Simple Source** | QUL - Imlaei Simple (Word by Word, aggregated) |
| **Encoding** | UTF-8 |

### Credits

- **[Tarteel AI](https://tarteel.ai/)** - For creating and maintaining QUL
- **[QUL (Quranic Universal Library)](https://qul.tarteel.ai/)** - Open-source Quranic resources platform
- Data sourced from the authoritative Medina Mushaf

## License

MIT © Yazin Alirhayim

Quran data is provided by [QUL/Tarteel](https://qul.tarteel.ai/) - please review their licensing terms for commercial use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
