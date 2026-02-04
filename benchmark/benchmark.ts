/**
 * Quran Validator LLM Benchmark
 *
 * Tests how accurately different LLMs can quote Quranic verses.
 *
 * Usage:
 *   export OPENROUTER_API_KEY='your-key'
 *   npm run benchmark
 */

import { LLMProcessor, SYSTEM_PROMPTS, QuranValidator, normalizeArabic } from 'quran-validator';
import * as fs from 'fs';

// ============================================================================
// CONFIGURATION - Edit these to customize the benchmark
// ============================================================================

const CONFIG = {
  // Models to test (OpenRouter model IDs)
  models: [
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', icon: '🟤' },
    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', icon: '🔵' },
    { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', icon: '🟢' },
    { id: 'x-ai/grok-code-fast-1', name: 'Grok Code Fast 1', icon: '⚫' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: '💎' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', icon: '🟡' },
    { id: 'stepfun/step-3.5-flash:free', name: 'Step 3.5 Flash', icon: '🔶' },
  ],

  // Test prompt
  prompt: 'What does the Quran say about giving to the needy? Please share one or two relevant verses.',

  // API settings
  maxTokens: 1000,
};

// ============================================================================
// TYPES
// ============================================================================

interface QuoteResult {
  reference: string;
  isValid: boolean;
  confidence: number;
  original: string;
  corrected?: string;
}

interface ModelResult {
  model: string;
  icon: string;
  response: string;
  quotes: QuoteResult[];
  validCount: number;
  totalCount: number;
  accuracy: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function normalizeForVisual(str: string): string {
  return str
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u061C]/g, '')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function visuallyEqual(a: string, b: string): boolean {
  return normalizeForVisual(a) === normalizeForVisual(b);
}

function calculateSimilarity(a: string, b: string): number {
  const normA = normalizeArabic(a);
  const normB = normalizeArabic(b);
  if (normA === normB) return 1;
  if (!normA || !normB) return 0;

  const longer = normA.length > normB.length ? normA : normB;
  const shorter = normA.length > normB.length ? normB : normA;
  if (longer.length === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= shorter.length; i++) matrix[i] = [i];
  for (let j = 0; j <= longer.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      if (shorter[i - 1] === longer[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return (longer.length - matrix[shorter.length][longer.length]) / longer.length;
}

function generateWordDiff(
  original: string,
  correct: string
): { originalHtml: string; correctHtml: string; hasDiff: boolean } {
  const origWords = original.split(/\s+/);
  const corrWords = correct.split(/\s+/);
  const corrUsed = new Set<number>();
  const origMatches: { idx: number | null; matchType: 'visual' | 'normalized' | 'none' }[] = [];

  for (let i = 0; i < origWords.length; i++) {
    let bestMatch: number | null = null;
    let bestType: 'visual' | 'normalized' | 'none' = 'none';

    for (let j = 0; j < corrWords.length; j++) {
      if (corrUsed.has(j)) continue;
      if (visuallyEqual(origWords[i], corrWords[j])) {
        bestMatch = j;
        bestType = 'visual';
        break;
      }
      if (normalizeArabic(origWords[i]) === normalizeArabic(corrWords[j]) && bestType === 'none') {
        bestMatch = j;
        bestType = 'normalized';
      }
    }

    if (bestMatch !== null) corrUsed.add(bestMatch);
    origMatches.push({ idx: bestMatch, matchType: bestType });
  }

  const hasDiff =
    origMatches.some((m) => m.matchType !== 'visual') ||
    corrWords.some((_, i) => !corrUsed.has(i));

  const originalHtml = origWords
    .map((word, i) => {
      const match = origMatches[i];
      if (match.matchType === 'visual') return word;
      if (match.matchType === 'normalized')
        return `<span class="diff-word-diacritic">${word}</span>`;
      return `<span class="diff-word-wrong">${word}</span>`;
    })
    .join(' ');

  const corrVisuallyMatched = new Set<number>();
  origMatches.forEach((match) => {
    if (match.idx !== null && match.matchType === 'visual') corrVisuallyMatched.add(match.idx);
  });

  const correctHtml = corrWords
    .map((word, i) => {
      if (corrVisuallyMatched.has(i)) return word;
      if (corrUsed.has(i)) return `<span class="diff-word-diacritic-correct">${word}</span>`;
      return `<span class="diff-word-correct">${word}</span>`;
    })
    .join(' ');

  return { originalHtml, correctHtml, hasDiff };
}

// ============================================================================
// API
// ============================================================================

async function queryModel(modelId: string, apiKey: string): Promise<string> {
  const systemPrompt = `You are a knowledgeable Islamic scholar. ${SYSTEM_PROMPTS.xml}

When asked about Quranic topics, provide relevant verses with their exact Arabic text.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: CONFIG.prompt },
      ],
      max_tokens: CONFIG.maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ============================================================================
// HTML GENERATION
// ============================================================================

function generateSummaryHTML(results: ModelResult[]): string {
  const sorted = [...results].sort((a, b) => b.accuracy - a.accuracy);
  const lowestAccuracy = Math.min(
    ...results.filter((r) => r.totalCount > 0).map((r) => r.accuracy)
  );

  const rows = sorted
    .map((r, i) => {
      const rank = i + 1;
      const isWinner = rank === 1 && r.accuracy === 100;
      const isLoser = r.accuracy === lowestAccuracy && r.totalCount > 0 && r.accuracy < 100;
      const noQuotes = r.totalCount === 0;

      let medal = isWinner ? '🏆' : rank === 2 && r.accuracy > 0 ? '🥈' : rank === 3 && r.accuracy > 0 ? '🥉' : '';
      let rowClass = isWinner ? 'winner-row' : isLoser ? 'loser-row' : noQuotes ? 'no-quotes-row' : '';
      const accuracyDisplay = noQuotes ? '—' : `${r.accuracy}%`;
      const statusIcon = noQuotes ? '🚫' : r.accuracy === 100 ? '✅' : '❌';

      return `
        <tr class="${rowClass}">
          <td class="rank-cell">${medal || rank}</td>
          <td class="model-cell">
            <span class="model-icon">${r.icon}</span>
            <span class="model-name">${r.model}</span>
            ${isLoser ? '<span class="loser-badge">BIGGEST LOSER</span>' : ''}
          </td>
          <td class="center">${r.totalCount || '—'}</td>
          <td class="center">${noQuotes ? '—' : r.validCount}</td>
          <td class="center accuracy-cell ${r.accuracy === 100 ? 'perfect' : r.accuracy === 0 ? 'zero' : ''}">${accuracyDisplay}</td>
          <td class="center">${statusIcon}</td>
        </tr>`;
    })
    .join('');

  const perfectCount = results.filter((r) => r.accuracy === 100).length;
  const testedCount = results.filter((r) => r.totalCount > 0).length;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: linear-gradient(145deg, #0f0f1a, #1a1a2e, #0f0f1a); color: #fff; padding: 50px 40px; min-height: 100vh; }
    .container { max-width: 750px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo { font-size: 48px; margin-bottom: 8px; }
    .header h1 { font-size: 36px; font-weight: 800; margin-bottom: 12px; background: linear-gradient(135deg, #00d4ff, #7b2ff7, #ff6b6b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header .subtitle { color: #666; font-size: 16px; }
    .stats-row { display: flex; justify-content: center; gap: 40px; margin: 30px 0; }
    .stat-box { text-align: center; }
    .stat-number { font-size: 32px; font-weight: 800; }
    .stat-number.green { color: #22c55e; }
    .stat-number.red { color: #ef4444; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .prompt-box { background: linear-gradient(135deg, rgba(123, 47, 247, 0.1), rgba(0, 212, 255, 0.1)); border: 1px solid rgba(123, 47, 247, 0.3); border-radius: 16px; padding: 20px 24px; margin-bottom: 30px; font-size: 15px; color: #aaa; }
    .prompt-box strong { color: #7b2ff7; }
    .prompt-box .prompt-text { color: #fff; font-style: italic; }
    table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
    th { padding: 12px 16px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
    td { padding: 18px 16px; background: rgba(255, 255, 255, 0.03); }
    tr td:first-child { border-radius: 12px 0 0 12px; }
    tr td:last-child { border-radius: 0 12px 12px 0; }
    .winner-row td { background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05)); border-top: 1px solid rgba(34, 197, 94, 0.3); border-bottom: 1px solid rgba(34, 197, 94, 0.3); }
    .winner-row td:first-child { border-left: 1px solid rgba(34, 197, 94, 0.3); }
    .winner-row td:last-child { border-right: 1px solid rgba(34, 197, 94, 0.3); }
    .loser-row td { background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.08)); border-top: 2px solid rgba(239, 68, 68, 0.5); border-bottom: 2px solid rgba(239, 68, 68, 0.5); }
    .loser-row td:first-child { border-left: 2px solid rgba(239, 68, 68, 0.5); }
    .loser-row td:last-child { border-right: 2px solid rgba(239, 68, 68, 0.5); }
    .no-quotes-row td { opacity: 0.5; }
    .rank-cell { font-size: 20px; font-weight: 700; width: 50px; text-align: center; }
    .model-cell { display: flex; align-items: center; gap: 12px; }
    .model-icon { font-size: 24px; }
    .model-name { font-weight: 600; font-size: 15px; }
    .loser-badge { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; font-size: 9px; font-weight: 700; padding: 4px 8px; border-radius: 4px; margin-left: 8px; }
    .center { text-align: center; }
    .accuracy-cell { font-weight: 700; font-size: 16px; }
    .accuracy-cell.perfect { color: #22c55e; }
    .accuracy-cell.zero { color: #ef4444; }
    .footer { text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid rgba(255, 255, 255, 0.1); }
    .footer-text { color: #444; font-size: 13px; }
    .footer-npm { margin-top: 12px; display: inline-block; background: rgba(123, 47, 247, 0.1); border: 1px solid rgba(123, 47, 247, 0.3); padding: 8px 16px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #7b2ff7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🕌</div>
      <h1>Can LLMs Quote the Quran?</h1>
      <p class="subtitle">Testing whether AI models can accurately cite Quranic verses</p>
    </div>
    <div class="stats-row">
      <div class="stat-box"><div class="stat-number">${testedCount}</div><div class="stat-label">Models Tested</div></div>
      <div class="stat-box"><div class="stat-number green">${perfectCount}</div><div class="stat-label">Perfect Scores</div></div>
      <div class="stat-box"><div class="stat-number red">${testedCount - perfectCount}</div><div class="stat-label">Made Errors</div></div>
    </div>
    <div class="prompt-box">
      <strong>Test Prompt:</strong><br>
      <span class="prompt-text">"${CONFIG.prompt}"</span>
    </div>
    <table>
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Model</th>
          <th class="center">Quotes</th>
          <th class="center">Valid</th>
          <th class="center">Accuracy</th>
          <th class="center"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">
      <div class="footer-text">Validated with quran-validator</div>
      <div class="footer-npm">npm install quran-validator</div>
    </div>
  </div>
</body>
</html>`;
}

function generateDetailHTML(results: ModelResult[], validator: QuranValidator): string {
  const invalidResults = results.filter((r) => r.quotes.some((q) => !q.isValid || q.corrected));
  if (invalidResults.length === 0) {
    return '<html><body style="background:#1a1a2e;color:#fff;padding:50px;font-family:sans-serif;text-align:center;"><h1>🎉 All models passed!</h1></body></html>';
  }

  const lowestAccuracy = Math.min(...results.filter((r) => r.totalCount > 0).map((r) => r.accuracy));

  const sections = invalidResults
    .map((r) => {
      const isLoser = r.accuracy === lowestAccuracy && r.totalCount > 0;
      const invalidQuotes = r.quotes.filter((q) => !q.isValid || q.corrected);

      const quoteDiffs = invalidQuotes
        .map((q) => {
          let correctText = q.corrected || '';
          if (!correctText && q.reference) {
            const parts = q.reference.split(':');
            correctText = validator.getVerse(parseInt(parts[0]), parseInt(parts[1]))?.text || '';
          }

          const isVisuallyIdentical = visuallyEqual(q.original, correctText);
          const similarity = calculateSimilarity(q.original, correctText);

          let diffContent = '';

          if (isVisuallyIdentical) {
            diffContent = `
              <div class="diff-container visual-match">
                <div class="match-message">
                  <span class="match-icon">✓</span>
                  <span class="match-text">Visually identical - encoding differences only</span>
                </div>
                <div class="diff-row correct">
                  <div class="diff-text" dir="rtl">${correctText}</div>
                </div>
              </div>`;
          } else if (similarity >= 0.5) {
            const { originalHtml, correctHtml, hasDiff } = generateWordDiff(q.original, correctText);
            if (!hasDiff) {
              diffContent = `
                <div class="diff-container visual-match">
                  <div class="match-message">
                    <span class="match-icon">✓</span>
                    <span class="match-text">Visually identical - encoding differences only</span>
                  </div>
                  <div class="diff-row correct">
                    <div class="diff-text" dir="rtl">${correctText}</div>
                  </div>
                </div>`;
            } else {
              const badge = similarity >= 0.95 ? '<span class="minor-badge">MINOR DIACRITIC ERRORS</span>' : '';
              diffContent = `
                <div class="diff-container word-diff">
                  <div class="diff-row wrong">
                    <div class="diff-label">❌ LLM OUTPUT ${badge}</div>
                    <div class="diff-text" dir="rtl">${originalHtml}</div>
                  </div>
                  <div class="diff-row correct">
                    <div class="diff-label">✅ AUTHENTIC</div>
                    <div class="diff-text" dir="rtl">${correctHtml}</div>
                  </div>
                </div>`;
            }
          } else {
            diffContent = `
              <div class="diff-container full-diff">
                <div class="diff-row wrong all-wrong">
                  <div class="diff-label">❌ LLM OUTPUT <span class="wrong-badge">COMPLETELY WRONG</span></div>
                  <div class="diff-text" dir="rtl">${q.original}</div>
                </div>
                <div class="diff-row correct">
                  <div class="diff-label">✅ AUTHENTIC</div>
                  <div class="diff-text" dir="rtl">${correctText}</div>
                </div>
              </div>`;
          }

          const similarityPct = Math.round(similarity * 100);
          const similarityClass = similarityPct >= 80 ? 'high' : similarityPct >= 50 ? 'medium' : 'low';

          return `
            <div class="quote-error">
              <div class="quote-header">
                <span class="ref">Verse ${q.reference || 'Unknown'}</span>
                <span class="confidence ${similarityClass}">${similarityPct}% match</span>
              </div>
              ${diffContent}
            </div>`;
        })
        .join('');

      return `
        <div class="model-section ${isLoser ? 'loser-section' : ''}">
          <div class="model-header">
            <div class="model-info">
              <span class="model-icon">${r.icon}</span>
              <span class="model-name">${r.model}</span>
              ${isLoser ? '<span class="loser-tag">👎 BIGGEST LOSER</span>' : ''}
            </div>
            <span class="model-stats ${r.validCount === 0 ? 'zero-valid' : ''}">${r.validCount}/${r.totalCount} valid</span>
          </div>
          ${quoteDiffs}
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: linear-gradient(145deg, #0f0f1a, #1a1a2e, #0f0f1a); color: #fff; padding: 50px 40px; min-height: 100vh; }
    .container { max-width: 850px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; }
    .header h1 { font-size: 32px; font-weight: 800; margin-bottom: 12px; color: #ef4444; }
    .header p { color: #666; font-size: 15px; }
    .model-section { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; margin-bottom: 30px; overflow: hidden; }
    .loser-section { border: 2px solid rgba(239, 68, 68, 0.5); box-shadow: 0 0 40px rgba(239, 68, 68, 0.15); }
    .model-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
    .model-info { display: flex; align-items: center; gap: 12px; }
    .model-icon { font-size: 28px; }
    .model-name { font-weight: 700; font-size: 18px; }
    .loser-tag { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 6px; margin-left: 12px; }
    .model-stats { color: #888; font-size: 15px; font-weight: 600; }
    .model-stats.zero-valid { color: #ef4444; }
    .quote-error { padding: 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    .quote-error:last-child { border-bottom: none; }
    .quote-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .ref { font-weight: 700; font-size: 16px; color: #7b2ff7; }
    .confidence { color: #666; font-size: 13px; background: rgba(255, 255, 255, 0.05); padding: 4px 10px; border-radius: 6px; }
    .confidence.high { color: #22c55e; }
    .confidence.medium { color: #fbbf24; }
    .confidence.low { color: #ef4444; font-weight: 600; }
    .diff-container { display: flex; flex-direction: column; gap: 12px; }
    .diff-row { border-radius: 12px; overflow: hidden; }
    .diff-row.wrong { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); }
    .diff-row.correct { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); }
    .diff-label { padding: 10px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .diff-row.wrong .diff-label { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .diff-row.correct .diff-label { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .diff-text { padding: 16px 20px; font-family: 'Amiri', serif; font-size: 22px; line-height: 2; text-align: right; }
    .diff-word-wrong { background: rgba(239, 68, 68, 0.6); border-radius: 4px; padding: 2px 6px; border-bottom: 3px solid #ef4444; }
    .diff-word-correct { background: rgba(34, 197, 94, 0.6); border-radius: 4px; padding: 2px 6px; border-bottom: 3px solid #22c55e; }
    .diff-word-diacritic { background: rgba(251, 191, 36, 0.4); border-radius: 4px; padding: 2px 6px; border-bottom: 3px solid #fbbf24; }
    .diff-word-diacritic-correct { background: rgba(34, 197, 94, 0.4); border-radius: 4px; padding: 2px 6px; border-bottom: 3px solid #22c55e; }
    .wrong-badge { background: #ef4444; color: #fff; font-size: 9px; padding: 3px 8px; border-radius: 4px; margin-left: 8px; font-weight: 700; }
    .minor-badge { background: #fbbf24; color: #000; font-size: 9px; padding: 3px 8px; border-radius: 4px; margin-left: 8px; font-weight: 700; }
    .all-wrong .diff-text { color: rgba(255, 255, 255, 0.7); }
    .visual-match { background: rgba(34, 197, 94, 0.05); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; overflow: hidden; }
    .match-message { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(34, 197, 94, 0.15); color: #22c55e; font-weight: 600; font-size: 14px; }
    .match-icon { font-size: 18px; }
    .visual-match .diff-row { border: none; background: transparent; }
    .visual-match .diff-text { color: rgba(255, 255, 255, 0.8); }
    .legend { display: flex; justify-content: center; gap: 30px; margin-top: 30px; padding: 20px; background: rgba(255, 255, 255, 0.02); border-radius: 12px; }
    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; }
    .legend-color { width: 16px; height: 16px; border-radius: 4px; }
    .legend-color.red { background: rgba(239, 68, 68, 0.3); border: 1px solid rgba(239, 68, 68, 0.5); }
    .legend-color.green { background: rgba(34, 197, 94, 0.3); border: 1px solid rgba(34, 197, 94, 0.5); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Validation Errors Found</h1>
      <p>Comparing LLM output against authentic Quranic text</p>
    </div>
    ${sections}
    <div class="legend">
      <div class="legend-item"><div class="legend-color red"></div><span>LLM generated (incorrect)</span></div>
      <div class="legend-item"><div class="legend-color green"></div><span>Authentic Quran text</span></div>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('❌ Please set OPENROUTER_API_KEY environment variable');
    console.error('   export OPENROUTER_API_KEY="your-key"');
    process.exit(1);
  }

  const processor = new LLMProcessor();
  const validator = new QuranValidator();
  const results: ModelResult[] = [];

  console.log('');
  console.log('🕌 Quran Validator - LLM Benchmark');
  console.log('━'.repeat(50));
  console.log('');

  for (const model of CONFIG.models) {
    process.stdout.write(`  ${model.icon} ${model.name}... `);

    try {
      const response = await queryModel(model.id, apiKey);
      const validated = processor.process(response);

      const quotes: QuoteResult[] = validated.quotes.map((q) => ({
        reference: q.reference || 'unknown',
        isValid: q.isValid,
        confidence: q.confidence,
        original: q.original,
        corrected: q.wasCorrected ? q.corrected : undefined,
      }));

      const validCount = quotes.filter((q) => q.isValid).length;
      const totalCount = quotes.length;
      const accuracy = totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 0;

      results.push({
        model: model.name,
        icon: model.icon,
        response,
        quotes,
        validCount,
        totalCount,
        accuracy,
      });

      const status = validCount === totalCount && totalCount > 0 ? '✓' : '⚠';
      console.log(`${status} ${validCount}/${totalCount}`);
    } catch (error) {
      console.log('✗ Error');
      results.push({
        model: model.name,
        icon: model.icon,
        response: '',
        quotes: [],
        validCount: 0,
        totalCount: 0,
        accuracy: 0,
      });
    }
  }

  console.log('');
  console.log('Generating reports...');

  fs.writeFileSync('results/summary.html', generateSummaryHTML(results));
  fs.writeFileSync('results/details.html', generateDetailHTML(results, validator));
  fs.writeFileSync('results/data.json', JSON.stringify(results, null, 2));

  console.log('  ✓ results/summary.html');
  console.log('  ✓ results/details.html');
  console.log('  ✓ results/data.json');
  console.log('');
  console.log('Run `npm run screenshot` to generate PNG images.');
  console.log('');
}

// Create results directory
fs.mkdirSync('results', { recursive: true });

main().catch(console.error);
