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

export function getProfileDef(id) {
  return RESUME_PROFILES[id] || RESUME_PROFILES[DEFAULT_PROFILE_ID];
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
