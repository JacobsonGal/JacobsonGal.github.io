/**
 * Registry of resumes editable in the resume editor.
 *
 * "gal" is the live site profile (data/profile.json) and can publish to GitHub.
 * "liat" is an editor-only resume: it lives only in this browser's storage,
 * is never published, and is never referenced by any public page.
 */

const GAL_DRAFT_KEY = 'gal-portfolio-profile-draft';
const LIAT_DRAFT_KEY = 'liat-resume-draft-v1';

const LIAT_SEED = {
  name: 'Liat Shalev',
  email: '',
  headline: '',
  location: '',
  about: [],
  urls: { portfolio: '', linkedin: '', github: '' },
  resume: {
    headline: '',
    location: '',
    phone: '',
    overview: [],
    skills: {},
    softSkills: [],
    languages: [],
  },
  experience: [],
  education: [],
  updatedAt: null,
};

export const DEFAULT_PROFILE_ID = 'gal';
export const ACTIVE_PROFILE_STORAGE_KEY = 'resume-editor-active-profile';

export const RESUME_PROFILES = {
  gal: {
    id: 'gal',
    label: 'Gal Jacobson',
    draftKey: GAL_DRAFT_KEY,
    publishable: true,
    editsExtras: false,
    live: true,
  },
  liat: {
    id: 'liat',
    label: 'Liat Shalev',
    draftKey: LIAT_DRAFT_KEY,
    publishable: false,
    editsExtras: true,
    live: false,
  },
};

const CUSTOM_LIST_KEY = 'resume-custom-profiles-v1';
const CUSTOM_DRAFT_PREFIX = 'custom-resume-draft-';

export function customDraftKey(id) {
  return `${CUSTOM_DRAFT_PREFIX}${id}`;
}

function readCustomList() {
  try {
    const raw = localStorage.getItem(CUSTOM_LIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeCustomList(list) {
  try {
    localStorage.setItem(CUSTOM_LIST_KEY, JSON.stringify(list));
  } catch {
    // ignore storage failures
  }
}

function customDef(entry) {
  return {
    id: entry.id,
    label: entry.label,
    draftKey: customDraftKey(entry.id),
    publishable: false,
    editsExtras: true,
    live: false,
    custom: true,
  };
}

// Repo-backed custom resumes: loaded from data/custom-resumes.json and saved back to GitHub.
let repoProfiles = [];

export function repoDraftKey(id) {
  // v2: older drafts used a lossy experience round-trip; bump so stale drafts are
  // ignored and repo-backed resumes reload cleanly from the committed file.
  return `repo-resume-draft-v2-${id}`;
}

function repoDef(entry) {
  return {
    id: entry.id,
    label: entry.label,
    draftKey: repoDraftKey(entry.id),
    publishable: false,
    editsExtras: true,
    live: false,
    custom: true,
    repo: true,
  };
}

export function setRepoProfiles(list) {
  repoProfiles = Array.isArray(list)
    ? list.filter((entry) => entry && entry.id && entry.profile)
    : [];
}

export function getRepoProfiles() {
  return repoProfiles;
}

export function getRepoProfile(id) {
  return repoProfiles.find((entry) => entry.id === id) || null;
}

export function listProfileDefs() {
  return [
    RESUME_PROFILES.gal,
    RESUME_PROFILES.liat,
    ...repoProfiles.map(repoDef),
    ...readCustomList().map(customDef),
  ];
}

export function getProfileDef(id) {
  if (RESUME_PROFILES[id]) return RESUME_PROFILES[id];
  const repoEntry = repoProfiles.find((item) => item.id === id);
  if (repoEntry) return repoDef(repoEntry);
  const entry = readCustomList().find((item) => item.id === id);
  if (entry) return customDef(entry);
  return RESUME_PROFILES[DEFAULT_PROFILE_ID];
}

export function createCustomProfile(label, seed) {
  const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entry = {
    id,
    label: (label || 'Custom resume').trim() || 'Custom resume',
    createdAt: new Date().toISOString(),
  };
  const list = readCustomList();
  list.push(entry);
  writeCustomList(list);
  const seeded = { ...(seed || structuredClone(LIAT_SEED)), updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(customDraftKey(id), JSON.stringify(seeded));
  } catch {
    // ignore storage failures
  }
  return customDef(entry);
}

export function deleteCustomProfile(id) {
  writeCustomList(readCustomList().filter((item) => item.id !== id));
  try {
    localStorage.removeItem(customDraftKey(id));
  } catch {
    // ignore storage failures
  }
}

export function seedProfile(id) {
  if (id === 'liat') return structuredClone(LIAT_SEED);
  return null;
}

const STRIP_BULLET = /^[-•*]\s*/;

export function experienceToText(experience = []) {
  return (experience || [])
    .map((entry) => {
      const head = [entry.title, entry.company, entry.dates, entry.location]
        .map((part) => (part || '').trim())
        .filter(Boolean)
        .join(' | ');
      const bullets = (entry.bullets || [])
        .map((bullet) => `- ${bullet}`)
        .join('\n');
      return bullets ? `${head}\n${bullets}` : head;
    })
    .filter(Boolean)
    .join('\n\n');
}

export function textToExperience(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length)
    .map((lines, index) => {
      const [head, ...rest] = lines;
      const [title = '', company = '', dates = '', location = ''] = head
        .split('|')
        .map((part) => part.trim());
      const bullets = rest
        .map((line) => line.replace(STRIP_BULLET, '').trim())
        .filter(Boolean);
      return {
        id: `role-${index + 1}`,
        title,
        company,
        dates,
        location,
        summary: '',
        bullets,
        highlights: [],
        stack: [],
      };
    })
    .filter((entry) => entry.title || entry.company);
}

export function educationToText(education = []) {
  return (education || [])
    .map((entry) => [entry.degree, entry.school, entry.dates, entry.field]
      .map((part) => (part || '').trim())
      .join(' | '))
    .filter((line) => line.replace(/\|/g, '').trim())
    .join('\n');
}

export function textToEducation(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [degree = '', school = '', dates = '', field = ''] = line
        .split('|')
        .map((part) => part.trim());
      return {
        id: `edu-${index + 1}`,
        degree,
        school,
        dates,
        field,
      };
    })
    .filter((entry) => entry.degree || entry.school);
}
