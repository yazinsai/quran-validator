/**
 * Script to fetch Quran data from AlQuran.cloud API
 * Run with: npm run fetch-quran
 */

import * as fs from 'fs';
import * as path from 'path';

interface ApiVerse {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  surah: {
    number: number;
    name: string;
    englishName: string;
    revelationType: string;
    numberOfAyahs: number;
  };
}

interface ApiResponse {
  code: number;
  status: string;
  data: {
    surahs: {
      number: number;
      name: string;
      englishName: string;
      revelationType: string;
      numberOfAyahs: number;
      ayahs: {
        number: number;
        text: string;
        numberInSurah: number;
        juz: number;
        page: number;
      }[];
    }[];
  };
}

interface ProcessedVerse {
  id: number;
  surah: number;
  ayah: number;
  text: string;
  textSimple: string;
  page: number;
  juz: number;
}

interface ProcessedSurah {
  number: number;
  name: string;
  englishName: string;
  versesCount: number;
  revelationType: 'Meccan' | 'Medinan';
}

/**
 * Clean text: remove BOM and other invisible characters
 */
function cleanText(text: string): string {
  // Remove BOM and zero-width characters
  return text.replace(/[\uFEFF\u200B-\u200D\uFFFE\uFFFF]/g, '');
}

/**
 * Remove diacritics from Arabic text
 */
function removeDiacritics(text: string): string {
  return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
}

async function fetchQuranData() {
  console.log('Fetching Quran data from AlQuran.cloud API...');

  // Fetch Uthmani text (with diacritics)
  const response = await fetch(
    'https://api.alquran.cloud/v1/quran/quran-uthmani'
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Quran data: ${response.statusText}`);
  }

  const data: ApiResponse = await response.json();

  if (data.code !== 200) {
    throw new Error(`API error: ${data.status}`);
  }

  console.log('Processing verses...');

  const verses: ProcessedVerse[] = [];
  const surahs: ProcessedSurah[] = [];

  let verseId = 1;

  for (const surah of data.data.surahs) {
    // Add surah info
    surahs.push({
      number: surah.number,
      name: surah.name,
      englishName: surah.englishName,
      versesCount: surah.ayahs.length,
      revelationType: surah.revelationType === 'Meccan' ? 'Meccan' : 'Medinan',
    });

    // Add verses
    for (const ayah of surah.ayahs) {
      const cleanedText = cleanText(ayah.text);
      verses.push({
        id: verseId++,
        surah: surah.number,
        ayah: ayah.numberInSurah,
        text: cleanedText,
        textSimple: removeDiacritics(cleanedText),
        page: ayah.page,
        juz: ayah.juz,
      });
    }
  }

  console.log(`Processed ${verses.length} verses from ${surahs.length} surahs`);

  // Write to data directory
  const dataDir = path.join(__dirname, '..', 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Write verses
  const versesPath = path.join(dataDir, 'quran-verses.json');
  fs.writeFileSync(versesPath, JSON.stringify(verses, null, 2));
  console.log(`Wrote verses to ${versesPath}`);

  // Write surahs
  const surahsPath = path.join(dataDir, 'quran-surahs.json');
  fs.writeFileSync(surahsPath, JSON.stringify(surahs, null, 2));
  console.log(`Wrote surahs to ${surahsPath}`);

  // Write minified versions for production
  const versesMinPath = path.join(dataDir, 'quran-verses.min.json');
  fs.writeFileSync(versesMinPath, JSON.stringify(verses));
  console.log(`Wrote minified verses to ${versesMinPath}`);

  const surahsMinPath = path.join(dataDir, 'quran-surahs.min.json');
  fs.writeFileSync(surahsMinPath, JSON.stringify(surahs));
  console.log(`Wrote minified surahs to ${surahsMinPath}`);

  // Create a normalized index for faster lookups
  console.log('Creating normalized index...');
  const normalizedIndex: Record<string, number[]> = {};

  for (const verse of verses) {
    // Normalize further for indexing: remove spaces, normalize alef, etc.
    const normalized = verse.textSimple
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedIndex[normalized]) {
      normalizedIndex[normalized] = [];
    }
    normalizedIndex[normalized].push(verse.id);
  }

  const indexPath = path.join(dataDir, 'normalized-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(normalizedIndex));
  console.log(`Wrote normalized index to ${indexPath}`);

  console.log('Done!');
}

fetchQuranData().catch(console.error);
