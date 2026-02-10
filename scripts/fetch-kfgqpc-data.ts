/**
 * Fetch riwayat data from KFGQPC GitHub repo and convert to our format.
 * Also extracts Hafs from our existing quran-verses.min.json.
 *
 * Usage: npx tsx scripts/fetch-kfgqpc-data.ts
 */

import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

const RIWAYAT_DIR = resolve(__dirname, '../data/riwayat');

interface KFGQPCEntry {
  id: number;
  jozz: number;
  page: string | number;
  sura_no: number;
  sura_name_en: string;
  sura_name_ar: string;
  line_start: number;
  line_end: number;
  aya_no: number;
  aya_text: string;
}

interface MinimalVerse {
  id: number;
  surah: number;
  ayah: number;
  text: string;
}

const KFGQPC_BASE = 'https://raw.githubusercontent.com/thetruetruth/quran-data-kfgqpc/main';

const RIWAYA_FILES: Record<string, string> = {
  warsh: 'warsh/data/warshData_v10.json',
  qalun: 'qaloon/data/QaloonData_v10.json',
  shuba: 'shouba/data/ShoubaData08.json',
  duri: 'doori/data/DooriData_v09.json',
  susi: 'soosi/data/SoosiData09.json',
  bazzi: 'bazzi/data/BazziData_v07.json',
  qunbul: 'qumbul/data/QumbulData_v07.json',
};

const METADATA = [
  { id: 'hafs', name: 'Hafs', nameArabic: 'حفص', qari: 'Asim', qariArabic: 'عاصم' },
  { id: 'warsh', name: 'Warsh', nameArabic: 'ورش', qari: "Nafi'", qariArabic: 'نافع' },
  { id: 'qalun', name: 'Qalun', nameArabic: 'قالون', qari: "Nafi'", qariArabic: 'نافع' },
  { id: 'shuba', name: "Shu'ba", nameArabic: 'شعبة', qari: 'Asim', qariArabic: 'عاصم' },
  { id: 'duri', name: 'Ad-Duri', nameArabic: 'الدوري', qari: 'Abu Amr', qariArabic: 'أبو عمرو' },
  { id: 'susi', name: 'As-Susi', nameArabic: 'السوسي', qari: 'Abu Amr', qariArabic: 'أبو عمرو' },
  { id: 'bazzi', name: 'Al-Bazzi', nameArabic: 'البزي', qari: 'Ibn Kathir', qariArabic: 'ابن كثير' },
  { id: 'qunbul', name: 'Qunbul', nameArabic: 'قنبل', qari: 'Ibn Kathir', qariArabic: 'ابن كثير' },
];

/**
 * Strip trailing Arabic-Indic verse number markers from aya_text.
 * Pattern: optional whitespace/NBSP + Arabic-Indic digits at end of string.
 */
function stripVerseMarker(text: string): string {
  return text.replace(/[\s\u00a0]*[\u0660-\u0669]+$/, '').trim();
}

async function fetchJSON(url: string): Promise<KFGQPCEntry[]> {
  console.log(`  Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

function convertKFGQPC(data: KFGQPCEntry[]): MinimalVerse[] {
  return data.map((entry, index) => ({
    id: index + 1,
    surah: entry.sura_no,
    ayah: entry.aya_no,
    text: stripVerseMarker(entry.aya_text),
  }));
}

function writeRiwaya(id: string, verses: MinimalVerse[]) {
  const outPath = resolve(RIWAYAT_DIR, `${id}.min.json`);
  writeFileSync(outPath, JSON.stringify(verses));
  console.log(`  Wrote ${outPath} (${verses.length} verses)`);
}

async function main() {
  // 1. Extract Hafs from existing data
  console.log('Extracting Hafs from quran-verses.min.json...');
  const hafsData = JSON.parse(
    readFileSync(resolve(__dirname, '../data/quran-verses.min.json'), 'utf-8')
  ) as Array<{ id: number; surah: number; ayah: number; text: string; textSimple: string }>;

  const hafsMinimal: MinimalVerse[] = hafsData.map(v => ({
    id: v.id,
    surah: v.surah,
    ayah: v.ayah,
    text: v.text,
  }));
  writeRiwaya('hafs', hafsMinimal);

  // 2. Fetch each KFGQPC riwaya
  for (const [id, path] of Object.entries(RIWAYA_FILES)) {
    console.log(`\nProcessing ${id}...`);
    const url = `${KFGQPC_BASE}/${path}`;
    const raw = await fetchJSON(url);
    const verses = convertKFGQPC(raw);
    writeRiwaya(id, verses);
  }

  // 3. Write metadata
  const metadataPath = resolve(RIWAYAT_DIR, 'metadata.json');
  writeFileSync(metadataPath, JSON.stringify(METADATA, null, 2));
  console.log(`\nWrote ${metadataPath}`);

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
