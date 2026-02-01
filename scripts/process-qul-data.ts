/**
 * Process QUL (Quranic Universal Library) data
 *
 * This script converts QUL's JSON format to our internal format,
 * combining Uthmani (authoritative) and Imlaei simple (for matching).
 *
 * Run with: npx tsx scripts/process-qul-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface QulUthmaniVerse {
  id: number;
  verse_key: string;
  surah: number;
  ayah: number;
  text: string;
}

interface QulImlaeiWord {
  id: number;
  surah: string;
  ayah: string;
  word: string;
  location: string;
  text: string;
}

interface ProcessedVerse {
  id: number;
  surah: number;
  ayah: number;
  text: string;           // Uthmani text (authoritative, with diacritics)
  textSimple: string;     // Imlaei simple (for matching, no diacritics)
}

interface ProcessedSurah {
  number: number;
  name: string;
  englishName: string;
  versesCount: number;
  revelationType: 'Meccan' | 'Medinan';
}

// Surah metadata (from Quran.com/AlQuran.cloud)
const SURAH_METADATA: Omit<ProcessedSurah, 'versesCount'>[] = [
  { number: 1, name: "الفاتحة", englishName: "Al-Fatiha", revelationType: "Meccan" },
  { number: 2, name: "البقرة", englishName: "Al-Baqara", revelationType: "Medinan" },
  { number: 3, name: "آل عمران", englishName: "Aal-i-Imran", revelationType: "Medinan" },
  { number: 4, name: "النساء", englishName: "An-Nisa", revelationType: "Medinan" },
  { number: 5, name: "المائدة", englishName: "Al-Ma'ida", revelationType: "Medinan" },
  { number: 6, name: "الأنعام", englishName: "Al-An'am", revelationType: "Meccan" },
  { number: 7, name: "الأعراف", englishName: "Al-A'raf", revelationType: "Meccan" },
  { number: 8, name: "الأنفال", englishName: "Al-Anfal", revelationType: "Medinan" },
  { number: 9, name: "التوبة", englishName: "At-Tawba", revelationType: "Medinan" },
  { number: 10, name: "يونس", englishName: "Yunus", revelationType: "Meccan" },
  { number: 11, name: "هود", englishName: "Hud", revelationType: "Meccan" },
  { number: 12, name: "يوسف", englishName: "Yusuf", revelationType: "Meccan" },
  { number: 13, name: "الرعد", englishName: "Ar-Ra'd", revelationType: "Medinan" },
  { number: 14, name: "إبراهيم", englishName: "Ibrahim", revelationType: "Meccan" },
  { number: 15, name: "الحجر", englishName: "Al-Hijr", revelationType: "Meccan" },
  { number: 16, name: "النحل", englishName: "An-Nahl", revelationType: "Meccan" },
  { number: 17, name: "الإسراء", englishName: "Al-Isra", revelationType: "Meccan" },
  { number: 18, name: "الكهف", englishName: "Al-Kahf", revelationType: "Meccan" },
  { number: 19, name: "مريم", englishName: "Maryam", revelationType: "Meccan" },
  { number: 20, name: "طه", englishName: "Ta-Ha", revelationType: "Meccan" },
  { number: 21, name: "الأنبياء", englishName: "Al-Anbiya", revelationType: "Meccan" },
  { number: 22, name: "الحج", englishName: "Al-Hajj", revelationType: "Medinan" },
  { number: 23, name: "المؤمنون", englishName: "Al-Mu'minun", revelationType: "Meccan" },
  { number: 24, name: "النور", englishName: "An-Nur", revelationType: "Medinan" },
  { number: 25, name: "الفرقان", englishName: "Al-Furqan", revelationType: "Meccan" },
  { number: 26, name: "الشعراء", englishName: "Ash-Shu'ara", revelationType: "Meccan" },
  { number: 27, name: "النمل", englishName: "An-Naml", revelationType: "Meccan" },
  { number: 28, name: "القصص", englishName: "Al-Qasas", revelationType: "Meccan" },
  { number: 29, name: "العنكبوت", englishName: "Al-Ankabut", revelationType: "Meccan" },
  { number: 30, name: "الروم", englishName: "Ar-Rum", revelationType: "Meccan" },
  { number: 31, name: "لقمان", englishName: "Luqman", revelationType: "Meccan" },
  { number: 32, name: "السجدة", englishName: "As-Sajda", revelationType: "Meccan" },
  { number: 33, name: "الأحزاب", englishName: "Al-Ahzab", revelationType: "Medinan" },
  { number: 34, name: "سبأ", englishName: "Saba", revelationType: "Meccan" },
  { number: 35, name: "فاطر", englishName: "Fatir", revelationType: "Meccan" },
  { number: 36, name: "يس", englishName: "Ya-Sin", revelationType: "Meccan" },
  { number: 37, name: "الصافات", englishName: "As-Saffat", revelationType: "Meccan" },
  { number: 38, name: "ص", englishName: "Sad", revelationType: "Meccan" },
  { number: 39, name: "الزمر", englishName: "Az-Zumar", revelationType: "Meccan" },
  { number: 40, name: "غافر", englishName: "Ghafir", revelationType: "Meccan" },
  { number: 41, name: "فصلت", englishName: "Fussilat", revelationType: "Meccan" },
  { number: 42, name: "الشورى", englishName: "Ash-Shura", revelationType: "Meccan" },
  { number: 43, name: "الزخرف", englishName: "Az-Zukhruf", revelationType: "Meccan" },
  { number: 44, name: "الدخان", englishName: "Ad-Dukhan", revelationType: "Meccan" },
  { number: 45, name: "الجاثية", englishName: "Al-Jathiya", revelationType: "Meccan" },
  { number: 46, name: "الأحقاف", englishName: "Al-Ahqaf", revelationType: "Meccan" },
  { number: 47, name: "محمد", englishName: "Muhammad", revelationType: "Medinan" },
  { number: 48, name: "الفتح", englishName: "Al-Fath", revelationType: "Medinan" },
  { number: 49, name: "الحجرات", englishName: "Al-Hujurat", revelationType: "Medinan" },
  { number: 50, name: "ق", englishName: "Qaf", revelationType: "Meccan" },
  { number: 51, name: "الذاريات", englishName: "Adh-Dhariyat", revelationType: "Meccan" },
  { number: 52, name: "الطور", englishName: "At-Tur", revelationType: "Meccan" },
  { number: 53, name: "النجم", englishName: "An-Najm", revelationType: "Meccan" },
  { number: 54, name: "القمر", englishName: "Al-Qamar", revelationType: "Meccan" },
  { number: 55, name: "الرحمن", englishName: "Ar-Rahman", revelationType: "Medinan" },
  { number: 56, name: "الواقعة", englishName: "Al-Waqi'a", revelationType: "Meccan" },
  { number: 57, name: "الحديد", englishName: "Al-Hadid", revelationType: "Medinan" },
  { number: 58, name: "المجادلة", englishName: "Al-Mujadila", revelationType: "Medinan" },
  { number: 59, name: "الحشر", englishName: "Al-Hashr", revelationType: "Medinan" },
  { number: 60, name: "الممتحنة", englishName: "Al-Mumtahina", revelationType: "Medinan" },
  { number: 61, name: "الصف", englishName: "As-Saff", revelationType: "Medinan" },
  { number: 62, name: "الجمعة", englishName: "Al-Jumu'a", revelationType: "Medinan" },
  { number: 63, name: "المنافقون", englishName: "Al-Munafiqun", revelationType: "Medinan" },
  { number: 64, name: "التغابن", englishName: "At-Taghabun", revelationType: "Medinan" },
  { number: 65, name: "الطلاق", englishName: "At-Talaq", revelationType: "Medinan" },
  { number: 66, name: "التحريم", englishName: "At-Tahrim", revelationType: "Medinan" },
  { number: 67, name: "الملك", englishName: "Al-Mulk", revelationType: "Meccan" },
  { number: 68, name: "القلم", englishName: "Al-Qalam", revelationType: "Meccan" },
  { number: 69, name: "الحاقة", englishName: "Al-Haqqa", revelationType: "Meccan" },
  { number: 70, name: "المعارج", englishName: "Al-Ma'arij", revelationType: "Meccan" },
  { number: 71, name: "نوح", englishName: "Nuh", revelationType: "Meccan" },
  { number: 72, name: "الجن", englishName: "Al-Jinn", revelationType: "Meccan" },
  { number: 73, name: "المزمل", englishName: "Al-Muzzammil", revelationType: "Meccan" },
  { number: 74, name: "المدثر", englishName: "Al-Muddaththir", revelationType: "Meccan" },
  { number: 75, name: "القيامة", englishName: "Al-Qiyama", revelationType: "Meccan" },
  { number: 76, name: "الإنسان", englishName: "Al-Insan", revelationType: "Medinan" },
  { number: 77, name: "المرسلات", englishName: "Al-Mursalat", revelationType: "Meccan" },
  { number: 78, name: "النبأ", englishName: "An-Naba", revelationType: "Meccan" },
  { number: 79, name: "النازعات", englishName: "An-Nazi'at", revelationType: "Meccan" },
  { number: 80, name: "عبس", englishName: "Abasa", revelationType: "Meccan" },
  { number: 81, name: "التكوير", englishName: "At-Takwir", revelationType: "Meccan" },
  { number: 82, name: "الانفطار", englishName: "Al-Infitar", revelationType: "Meccan" },
  { number: 83, name: "المطففين", englishName: "Al-Mutaffifin", revelationType: "Meccan" },
  { number: 84, name: "الانشقاق", englishName: "Al-Inshiqaq", revelationType: "Meccan" },
  { number: 85, name: "البروج", englishName: "Al-Buruj", revelationType: "Meccan" },
  { number: 86, name: "الطارق", englishName: "At-Tariq", revelationType: "Meccan" },
  { number: 87, name: "الأعلى", englishName: "Al-A'la", revelationType: "Meccan" },
  { number: 88, name: "الغاشية", englishName: "Al-Ghashiya", revelationType: "Meccan" },
  { number: 89, name: "الفجر", englishName: "Al-Fajr", revelationType: "Meccan" },
  { number: 90, name: "البلد", englishName: "Al-Balad", revelationType: "Meccan" },
  { number: 91, name: "الشمس", englishName: "Ash-Shams", revelationType: "Meccan" },
  { number: 92, name: "الليل", englishName: "Al-Layl", revelationType: "Meccan" },
  { number: 93, name: "الضحى", englishName: "Ad-Duha", revelationType: "Meccan" },
  { number: 94, name: "الشرح", englishName: "Ash-Sharh", revelationType: "Meccan" },
  { number: 95, name: "التين", englishName: "At-Tin", revelationType: "Meccan" },
  { number: 96, name: "العلق", englishName: "Al-Alaq", revelationType: "Meccan" },
  { number: 97, name: "القدر", englishName: "Al-Qadr", revelationType: "Meccan" },
  { number: 98, name: "البينة", englishName: "Al-Bayyina", revelationType: "Medinan" },
  { number: 99, name: "الزلزلة", englishName: "Az-Zalzala", revelationType: "Medinan" },
  { number: 100, name: "العاديات", englishName: "Al-Adiyat", revelationType: "Meccan" },
  { number: 101, name: "القارعة", englishName: "Al-Qari'a", revelationType: "Meccan" },
  { number: 102, name: "التكاثر", englishName: "At-Takathur", revelationType: "Meccan" },
  { number: 103, name: "العصر", englishName: "Al-Asr", revelationType: "Meccan" },
  { number: 104, name: "الهمزة", englishName: "Al-Humaza", revelationType: "Meccan" },
  { number: 105, name: "الفيل", englishName: "Al-Fil", revelationType: "Meccan" },
  { number: 106, name: "قريش", englishName: "Quraysh", revelationType: "Meccan" },
  { number: 107, name: "الماعون", englishName: "Al-Ma'un", revelationType: "Meccan" },
  { number: 108, name: "الكوثر", englishName: "Al-Kawthar", revelationType: "Meccan" },
  { number: 109, name: "الكافرون", englishName: "Al-Kafirun", revelationType: "Meccan" },
  { number: 110, name: "النصر", englishName: "An-Nasr", revelationType: "Medinan" },
  { number: 111, name: "المسد", englishName: "Al-Masad", revelationType: "Meccan" },
  { number: 112, name: "الإخلاص", englishName: "Al-Ikhlas", revelationType: "Meccan" },
  { number: 113, name: "الفلق", englishName: "Al-Falaq", revelationType: "Meccan" },
  { number: 114, name: "الناس", englishName: "An-Nas", revelationType: "Meccan" },
];

async function processQulData() {
  const uthmaniPath = '/Users/rock/Downloads/uthmani.json';
  const imlaeiPath = '/Users/rock/Downloads/imlaei-simple.json';

  console.log('Loading QUL data...');

  // Load Uthmani data (keyed by verse_key like "1:1")
  const uthmaniRaw = JSON.parse(fs.readFileSync(uthmaniPath, 'utf-8'));
  const uthmaniData: Record<string, QulUthmaniVerse> = uthmaniRaw;

  // Load Imlaei word data (keyed by location like "1:1:1")
  const imlaeiRaw = JSON.parse(fs.readFileSync(imlaeiPath, 'utf-8'));
  const imlaeiData: Record<string, QulImlaeiWord> = imlaeiRaw;

  console.log(`Loaded ${Object.keys(uthmaniData).length} Uthmani verses`);
  console.log(`Loaded ${Object.keys(imlaeiData).length} Imlaei words`);

  // Aggregate Imlaei words into ayahs
  console.log('Aggregating Imlaei words into ayahs...');
  const imlaeiAyahs: Record<string, string[]> = {};

  for (const [location, word] of Object.entries(imlaeiData)) {
    const verseKey = `${word.surah}:${word.ayah}`;
    if (!imlaeiAyahs[verseKey]) {
      imlaeiAyahs[verseKey] = [];
    }
    // Store at the correct word index
    const wordIndex = parseInt(word.word) - 1;
    imlaeiAyahs[verseKey][wordIndex] = word.text;
  }

  // Join words into full ayahs (removing verse number markers like ١٢٣)
  const arabicNumerals = /[٠١٢٣٤٥٦٧٨٩]+/g;
  const imlaeiVerses: Record<string, string> = {};
  for (const [verseKey, words] of Object.entries(imlaeiAyahs)) {
    const fullText = words.filter(Boolean).join(' ');
    // Remove Arabic verse numbers that appear at the end
    imlaeiVerses[verseKey] = fullText.replace(arabicNumerals, '').trim();
  }

  console.log(`Aggregated ${Object.keys(imlaeiVerses).length} Imlaei ayahs`);

  // Process into our format
  console.log('Processing verses...');
  const verses: ProcessedVerse[] = [];
  const surahVerseCounts: Record<number, number> = {};

  for (const [verseKey, uthmani] of Object.entries(uthmaniData)) {
    const imlaeiText = imlaeiVerses[verseKey] || '';

    verses.push({
      id: uthmani.id,
      surah: uthmani.surah,
      ayah: uthmani.ayah,
      text: uthmani.text,
      textSimple: imlaeiText,
    });

    // Count verses per surah
    surahVerseCounts[uthmani.surah] = (surahVerseCounts[uthmani.surah] || 0) + 1;
  }

  // Sort by ID to ensure correct order
  verses.sort((a, b) => a.id - b.id);

  // Build surah metadata with verse counts
  const surahs: ProcessedSurah[] = SURAH_METADATA.map(meta => ({
    ...meta,
    versesCount: surahVerseCounts[meta.number] || 0,
  }));

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
    // Use the Imlaei simple text for indexing (already simplified)
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

  // Print sample verses for verification
  console.log('\n--- Sample verses (QUL data) ---');
  console.log('1:1 Uthmani:', verses[0].text);
  console.log('1:1 Imlaei:', verses[0].textSimple);
  console.log('\n2:255 (Ayat al-Kursi):');
  const ayatKursi = verses.find(v => v.surah === 2 && v.ayah === 255);
  if (ayatKursi) {
    console.log('Uthmani:', ayatKursi.text.slice(0, 100) + '...');
    console.log('Imlaei:', ayatKursi.textSimple.slice(0, 100) + '...');
  }

  console.log('\nDone! QUL data processed successfully.');
}

processQulData().catch(console.error);
