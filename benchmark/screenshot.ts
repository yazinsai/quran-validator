/**
 * Generate PNG screenshots from HTML reports
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  if (!fs.existsSync('results/summary.html')) {
    console.error('❌ No results found. Run `npm run benchmark` first.');
    process.exit(1);
  }

  console.log('');
  console.log('📸 Generating screenshots...');
  console.log('');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 1200 });

  await page.goto(`file://${path.resolve('./results/summary.html')}`);
  await page.screenshot({ path: 'results/summary.png', fullPage: true, scale: 'device' });
  console.log('  ✓ results/summary.png');

  await page.goto(`file://${path.resolve('./results/details.html')}`);
  await page.screenshot({ path: 'results/details.png', fullPage: true, scale: 'device' });
  console.log('  ✓ results/details.png');

  await browser.close();

  console.log('');
  console.log('Done! Screenshots saved to results/');
  console.log('');
}

main().catch(console.error);
