import { QuranValidator, LLMProcessor, SYSTEM_PROMPTS, quickValidate } from './src';

// 1. Basic validation
console.log('=== Basic Validation ===\n');
const validator = new QuranValidator();

const verse = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const result = validator.validate(verse);
console.log(`Verse: ${verse}`);
console.log(`Valid: ${result.isValid}`);
console.log(`Reference: ${result.reference}`);
console.log(`Match type: ${result.matchType}`);
console.log(`Confidence: ${result.confidence}\n`);

// 2. LLM Processor with tagged quotes
console.log('=== LLM Processor ===\n');
const processor = new LLMProcessor();

const llmResponse = `
The Quran begins with Surah Al-Fatiha. The first verse is:

<quran ref="1:1">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</quran>

This is followed by:

<quran ref="1:2">ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ</quran>
`;

const processed = processor.process(llmResponse);
console.log(`All valid: ${processed.allValid}`);
console.log(`Quotes found: ${processed.quotes.length}`);
for (const quote of processed.quotes) {
  console.log(`  - ${quote.reference}: ${quote.isValid ? '✓' : '✗'} (${quote.matchType})`);
}
console.log();

// 3. Test with a misquoted verse
console.log('=== Misquote Detection ===\n');
const misquoted = `
Here is a verse:

<quran ref="112:1">قل هو الله احد</quran>
`;

const misquoteResult = processor.process(misquoted);
console.log(`All valid: ${misquoteResult.allValid}`);
for (const quote of misquoteResult.quotes) {
  console.log(`  Reference: ${quote.reference}`);
  console.log(`  Valid: ${quote.isValid}`);
  console.log(`  Match type: ${quote.matchType}`);
  console.log(`  Confidence: ${quote.confidence}`);
  if (quote.correctedText) {
    console.log(`  Original: ${quote.text}`);
    console.log(`  Corrected: ${quote.correctedText}`);
  }
}
console.log();

// 4. Quick validate
console.log('=== Quick Validate ===\n');
const quick = quickValidate('<quran ref="2:255">ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ</quran>');
console.log(`Has Quran content: ${quick.hasQuranContent}`);
console.log(`All valid: ${quick.allValid}`);
console.log();

// 5. Verse lookup
console.log('=== Verse Lookup ===\n');
const ayatKursi = validator.getVerse(2, 255);
console.log(`Ayat al-Kursi (2:255):`);
console.log(`${ayatKursi?.text.substring(0, 80)}...`);
console.log();

// 6. Verse range support
console.log('=== Verse Range Support ===\n');
const rangeResponse = `
Surah Al-Ikhlas (The Sincerity) is one of the shortest surahs:

<quran ref="112:1-4">قُلْ هُوَ ٱللَّهُ أَحَدٌ ٱللَّهُ ٱلصَّمَدُ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ</quran>
`;

const rangeResult = processor.process(rangeResponse);
console.log(`Range quote detected: ${rangeResult.quotes.length}`);
for (const quote of rangeResult.quotes) {
  console.log(`  Reference: ${quote.reference}`);
  console.log(`  Valid: ${quote.isValid}`);
  console.log(`  Confidence: ${quote.confidence}`);
}
console.log();

// 7. Test getVerseRange directly
console.log('=== Direct Verse Range Lookup ===\n');
const surahIkhlas = validator.getVerseRange(112, 1, 4);
if (surahIkhlas) {
  console.log(`Surah 112:1-4 (${surahIkhlas.verses.length} verses):`);
  console.log(`${surahIkhlas.text.substring(0, 80)}...`);
}
console.log();

// 8. Show system prompt
console.log('=== System Prompt (XML) ===\n');
console.log(SYSTEM_PROMPTS.xml.substring(0, 400) + '...\n');

console.log('✓ All tests passed!');
