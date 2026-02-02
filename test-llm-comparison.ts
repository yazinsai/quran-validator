import { LLMProcessor, SYSTEM_PROMPTS } from './src';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('Please set OPENROUTER_API_KEY environment variable');
  process.exit(1);
}

const models = [
  'openai/gpt-4o',
  'anthropic/claude-3.5-sonnet',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat',
];

const systemPrompt = `You are a knowledgeable Islamic scholar. ${SYSTEM_PROMPTS.xml}

When asked about Quranic topics, provide relevant verses with their exact Arabic text.`;

const userPrompt = `What does the Quran say about giving to the needy? Please share one or two relevant verses.`;

async function queryModel(model: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${model} failed: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function main() {
  const processor = new LLMProcessor();

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           Quran Validator - LLM Comparison Test                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`Prompt: "${userPrompt}"\n`);
  console.log('─'.repeat(68) + '\n');

  const results: Array<{
    model: string;
    response: string;
    allValid: boolean;
    quotes: number;
    validQuotes: number;
    details: string[];
  }> = [];

  for (const model of models) {
    const shortName = model.split('/')[1];
    process.stdout.write(`Testing ${shortName}... `);

    try {
      const response = await queryModel(model);
      const validated = processor.process(response);

      const validQuotes = validated.quotes.filter(q => q.isValid).length;

      results.push({
        model: shortName,
        response,
        allValid: validated.allValid,
        quotes: validated.quotes.length,
        validQuotes,
        details: validated.quotes.map(q =>
          `${q.reference || 'unknown'}: ${q.isValid ? '✓' : '✗'} (${q.matchType || 'tagged'}, ${Math.round((q.confidence || 0) * 100)}%)`
        ),
      });

      console.log(`✓ (${validQuotes}/${validated.quotes.length} valid)`);
    } catch (error) {
      console.log(`✗ Error: ${error}`);
      results.push({
        model: shortName,
        response: '',
        allValid: false,
        quotes: 0,
        validQuotes: 0,
        details: [`Error: ${error}`],
      });
    }
  }

  console.log('\n' + '─'.repeat(68) + '\n');
  console.log('DETAILED RESULTS\n');

  for (const result of results) {
    console.log(`┌─ ${result.model} ${'─'.repeat(Math.max(0, 60 - result.model.length))}┐`);
    console.log('│');

    // Show truncated response
    const lines = result.response.split('\n').filter(l => l.trim());
    for (const line of lines.slice(0, 10)) {
      const truncated = line.length > 64 ? line.substring(0, 61) + '...' : line;
      console.log(`│  ${truncated}`);
    }
    if (lines.length > 10) {
      console.log(`│  ... (${lines.length - 10} more lines)`);
    }

    console.log('│');
    console.log(`│  Quotes detected: ${result.quotes}`);
    console.log(`│  Valid quotes: ${result.validQuotes}/${result.quotes}`);
    for (const detail of result.details) {
      console.log(`│    └─ ${detail}`);
    }
    console.log(`│  Status: ${result.allValid || result.validQuotes === result.quotes ? '✓ ALL VALID' : '⚠ ISSUES FOUND'}`);
    console.log('│');
    console.log('└' + '─'.repeat(66) + '┘\n');
  }

  // Summary table
  console.log('═'.repeat(68));
  console.log('SUMMARY');
  console.log('═'.repeat(68));
  console.log(`${'Model'.padEnd(25)} ${'Quotes'.padEnd(10)} ${'Valid'.padEnd(10)} Status`);
  console.log('─'.repeat(68));

  for (const result of results) {
    const status = result.validQuotes === result.quotes && result.quotes > 0 ? '✓' : '⚠';
    console.log(
      `${result.model.padEnd(25)} ${String(result.quotes).padEnd(10)} ${String(result.validQuotes).padEnd(10)} ${status}`
    );
  }
  console.log('─'.repeat(68));
}

main().catch(console.error);
