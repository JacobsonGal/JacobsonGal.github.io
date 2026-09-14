/**
 * Browser-side resume tailoring via an LLM.
 *
 * The owner supplies their own API key (stored locally in the editor). Calls go
 * directly from the browser to the provider — Anthropic (with the explicit
 * browser-access header) or OpenAI. No server is involved.
 *
 * The model is constrained to REWEIGHT and REPHRASE existing resume content to
 * match a job; it must not invent facts.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const AI_SETTINGS = {
  keyStorage: 'resume-ai-key',
  providerStorage: 'resume-ai-provider',
  modelStorage: 'resume-ai-model',
};

const SYSTEM_PROMPT = [
  'You are an expert technical resume editor.',
  'You receive a candidate resume as a JSON object and a target job description.',
  'Return an updated version of the SAME JSON object, tailored to the job.',
  '',
  'STRICT RULES:',
  '- Never invent or exaggerate. Use only facts already present in the resume (employers, titles, dates, education, metrics, skills). Do not add skills the candidate does not list, fake experience, or fabricated numbers.',
  '- You MAY rewrite resume.overview to foreground the most relevant strengths; reorder and reword experience bullets to surface relevant work; reorder resume.skills groups and items and resume.softSkills to match what the role asks for.',
  '- Keep the exact same JSON schema and all keys and ids. Keep company names, dates, and education unchanged.',
  '- Keep language concise and professional. Do not use first person. Do not use em dashes or semicolons; use hyphens (-).',
  '- Return ONLY the JSON object, with no markdown fences and no commentary.',
].join('\n');

export function defaultModelFor(provider) {
  if (provider === 'openai') return 'gpt-4o';
  if (provider === 'gemini') return 'gemini-2.5-flash';
  return 'claude-3-5-sonnet-latest';
}

export function loadAiSettings() {
  try {
    return {
      provider: localStorage.getItem(AI_SETTINGS.providerStorage) || 'anthropic',
      model: localStorage.getItem(AI_SETTINGS.modelStorage) || '',
      key: localStorage.getItem(AI_SETTINGS.keyStorage) || '',
    };
  } catch {
    return { provider: 'anthropic', model: '', key: '' };
  }
}

export function saveAiSettings({ provider, model, key }) {
  try {
    if (provider) localStorage.setItem(AI_SETTINGS.providerStorage, provider);
    localStorage.setItem(AI_SETTINGS.modelStorage, model || '');
    if (key) localStorage.setItem(AI_SETTINGS.keyStorage, key);
  } catch {
    // ignore storage failures
  }
}

export function hasAiKey() {
  return Boolean(loadAiSettings().key);
}

function extractJson(text) {
  if (!text) return null;
  let body = String(text).trim();
  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) body = fenced[1].trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callAnthropic({ apiKey, model, system, user }) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Anthropic request failed (${response.status}).`);
  }
  return (data.content || []).filter((block) => block.type === 'text').map((block) => block.text).join('');
}

async function callOpenAI({ apiKey, model, system, user }) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI request failed (${response.status}).`);
  }
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini({ apiKey, model, system, user }) {
  const response = await fetch(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini request failed (${response.status}).`);
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('');
}

export async function tailorResumeToRole({ profile, jobDescription, apiKey, provider = 'anthropic', model }) {
  if (!apiKey) throw new Error('Add an AI API key in AI settings first.');
  if (!jobDescription || !jobDescription.trim()) throw new Error('Paste the job description first.');

  const useModel = (model && model.trim()) || defaultModelFor(provider);
  const user = `TARGET JOB:\n${jobDescription.trim()}\n\nRESUME JSON:\n${JSON.stringify(profile)}\n\nReturn the tailored resume JSON only.`;

  let text;
  if (provider === 'openai') {
    text = await callOpenAI({ apiKey, model: useModel, system: SYSTEM_PROMPT, user });
  } else if (provider === 'gemini') {
    text = await callGemini({ apiKey, model: useModel, system: SYSTEM_PROMPT, user });
  } else {
    text = await callAnthropic({ apiKey, model: useModel, system: SYSTEM_PROMPT, user });
  }

  const json = extractJson(text);
  if (!json || typeof json !== 'object' || !json.resume) {
    throw new Error('The AI returned an unexpected format. Try again, or change the model in AI settings.');
  }

  // Merge defensively so a missing key from the model never drops resume sections.
  return {
    ...profile,
    ...json,
    resume: { ...(profile.resume || {}), ...(json.resume || {}) },
    experience: Array.isArray(json.experience) ? json.experience : profile.experience,
    education: Array.isArray(json.education) ? json.education : profile.education,
    updatedAt: new Date().toISOString(),
  };
}
