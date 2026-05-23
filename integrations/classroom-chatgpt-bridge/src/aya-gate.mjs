import fs from 'fs';
import path from 'path';

const URL_RE = /\bhttps?:\/\/[^\s)<>"']+/gi;

function loadPolicy(policyPath) {
  const resolved = path.isAbsolute(policyPath)
    ? policyPath
    : path.join(process.cwd(), policyPath);
  if (!fs.existsSync(resolved)) {
    return null;
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw);
}

function defaultPolicyPath() {
  return process.env.AYA_POLICY_PATH || path.join(process.cwd(), 'config', 'aya-policy.json');
}

/**
 * @returns {{ ok: boolean, reasons: string[], policy: object|null }}
 */
export function gateContent(text, policyPath = defaultPolicyPath()) {
  const reasons = [];
  if (typeof text !== 'string') {
    return { ok: false, reasons: ['Content must be a string'], policy: null };
  }

  const policy = loadPolicy(policyPath);
  if (!policy) {
    return {
      ok: false,
      reasons: [`AYA policy file missing: ${policyPath}`],
      policy: null,
    };
  }

  const bytes = Buffer.byteLength(text, 'utf8');
  if (policy.maxBytes != null && bytes > policy.maxBytes) {
    reasons.push(`Exceeds maxBytes (${bytes} > ${policy.maxBytes})`);
  }
  if (policy.maxCharacters != null && text.length > policy.maxCharacters) {
    reasons.push(`Exceeds maxCharacters (${text.length} > ${policy.maxCharacters})`);
  }

  for (const phrase of policy.requiredPhrases || []) {
    if (!text.toLowerCase().includes(String(phrase).toLowerCase())) {
      reasons.push(`Missing required phrase: "${phrase}"`);
    }
  }

  for (const phrase of policy.blockedPhrases || []) {
    if (text.toLowerCase().includes(String(phrase).toLowerCase())) {
      reasons.push(`Blocked phrase matched: "${phrase}"`);
    }
  }

  for (const pattern of policy.blockedRegex || []) {
    try {
      const re = new RegExp(pattern, 'i');
      if (re.test(text)) {
        reasons.push(`Blocked pattern matched: ${pattern}`);
      }
    } catch {
      reasons.push(`Invalid regex in policy (skipped): ${pattern}`);
    }
  }

  const urls = text.match(URL_RE) || [];
  for (const u of urls) {
    let url;
    try {
      url = new URL(u.replace(/[.,;]+$/, ''));
    } catch {
      reasons.push(`Malformed URL: ${u}`);
      continue;
    }
    if (policy.allowOnlyHttpsLinks && url.protocol !== 'https:') {
      reasons.push(`Non-HTTPS link not allowed: ${url.href}`);
    }
    const host = url.hostname.toLowerCase();
    for (const bad of policy.blockedUrlHosts || []) {
      if (host === bad || host.endsWith(`.${bad}`)) {
        reasons.push(`Blocked URL host: ${host}`);
      }
    }
  }

  const allow = policy.allowedUrlHosts || [];
  if (allow.length > 0) {
    for (const u of urls) {
      let url;
      try {
        url = new URL(u.replace(/[.,;]+$/, ''));
      } catch {
        continue;
      }
      const host = url.hostname.toLowerCase();
      const ok = allow.some((h) => host === h || host.endsWith(`.${h}`));
      if (!ok) {
        reasons.push(`URL host not in allowlist: ${host}`);
      }
    }
  }

  const ok = reasons.length === 0;
  return { ok, reasons, policy };
}

export function assertGateOrExit(text, policyPath) {
  const result = gateContent(text, policyPath);
  if (!result.ok && result.policy?.blockOnFailure !== false) {
    console.error('AYA gate FAILED:');
    for (const r of result.reasons) console.error(' -', r);
    process.exit(1);
  }
  if (!result.ok) {
    console.warn('AYA gate warnings (blockOnFailure=false):');
    for (const r of result.reasons) console.warn(' -', r);
  }
  return result;
}
