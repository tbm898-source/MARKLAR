import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadAyaSummary(policyPath) {
  const p = policyPath || process.env.AYA_POLICY_PATH || path.join(process.cwd(), 'config', 'aya-policy.json');
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return j.ayaStatement || 'Follow school-appropriate, accurate, inclusive language.';
  } catch {
    return 'Follow school-appropriate, accurate, inclusive language.';
  }
}

/**
 * Draft text suitable for Google Classroom (teacher still reviews; AYA gate runs separately).
 */
export async function draftForClassroom(userPrompt, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Set OPENAI_API_KEY in .env');
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const aya = loadAyaSummary(options.policyPath);

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: [
          'You help a teacher draft short Google Classroom announcements or instructions.',
          'Constraints:',
          '- Plain language, appropriate for secondary students unless specified otherwise.',
          '- No jokes at students expense; no sensitive personal data.',
          '- No external tool signup links unless the teacher prompt explicitly requires them.',
          `- Institution AYA note: ${aya}`,
          'Output only the announcement body text (no markdown fences unless the teacher asked for formatting).',
        ].join('\n'),
      },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.6,
    max_tokens: 1200,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Empty model response');
  }
  return text;
}
