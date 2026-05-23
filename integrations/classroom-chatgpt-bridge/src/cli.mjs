#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { authorizeGoogle } from './google-auth.mjs';
import { listActiveCourses, postAnnouncement } from './classroom.mjs';
import { gateContent } from './aya-gate.mjs';
import { draftForClassroom } from './openai-bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });
process.chdir(ROOT);

const [, , cmd, ...rest] = process.argv;

function argValue(name) {
  const i = rest.indexOf(name);
  if (i === -1 || i + 1 >= rest.length) return null;
  return rest[i + 1];
}

function restText() {
  const i = rest.indexOf('--');
  if (i !== -1) return rest.slice(i + 1).join(' ').trim();
  return rest.join(' ').trim();
}

async function main() {
  if (!cmd || cmd === 'help' || cmd === '-h') {
    console.log(`
classroom-chatgpt-bridge

  npm run auth-google          First-time Google OAuth (saves token.json)
  node src/cli.mjs courses     List active Classroom courses
  node src/cli.mjs gate --text "..."     Check text against AYA policy
  node src/cli.mjs draft -- "Your prompt for the model"
  node src/cli.mjs post-announcement --courseId ID --text "..." [--dry-run]

Environment: copy .env.example to .env. Add OPENAI_API_KEY.
Google: enable Classroom API; OAuth Desktop client; redirect:
  http://127.0.0.1:53682/oauth2callback
`);
    return;
  }

  if (cmd === 'auth-google') {
    const hadToken = fs.existsSync(path.join(ROOT, 'token.json'));
    await authorizeGoogle();
    if (!hadToken) console.log('Saved token.json. You can run: npm run courses');
    else console.log('Already had token.json (refreshed if needed).');
    return;
  }

  if (cmd === 'courses') {
    const courses = await listActiveCourses();
    for (const c of courses) {
      console.log(`${c.id}\t${c.nameSectionEnrollmentCode || ''}\t${c.name}`);
    }
    return;
  }

  if (cmd === 'gate') {
    const text = argValue('--text') || restText();
    if (!text) {
      console.error('Usage: gate --text "..."');
      process.exit(1);
    }
    const r = gateContent(text);
    if (r.ok) {
      console.log('AYA gate: OK');
    } else {
      console.log('AYA gate: FAIL');
      for (const x of r.reasons) console.log(' -', x);
      if (r.policy?.blockOnFailure !== false) process.exit(1);
    }
    return;
  }

  if (cmd === 'draft') {
    const prompt = restText();
    if (!prompt) {
      console.error('Usage: draft -- "Prompt for OpenAI"');
      process.exit(1);
    }
    const text = await draftForClassroom(prompt);
    console.log('--- DRAFT (run gate before posting) ---\n');
    console.log(text);
    console.log('\n--- AYA check ---');
    const r = gateContent(text);
    if (r.ok) console.log('OK');
    else {
      console.log('FAIL (edit draft or policy before Classroom post):');
      for (const x of r.reasons) console.log(' -', x);
    }
    return;
  }

  if (cmd === 'post-announcement') {
    const courseId = argValue('--courseId');
    const text = argValue('--text');
    const dryRun = rest.includes('--dry-run');
    if (!courseId || !text) {
      console.error('Usage: post-announcement --courseId ID --text "..." [--dry-run]');
      process.exit(1);
    }
    const out = await postAnnouncement({ courseId, text, dryRun });
    if (!dryRun) console.log('Posted:', out.id || JSON.stringify(out));
    return;
  }

  console.error('Unknown command:', cmd);
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
