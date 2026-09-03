const STORAGE_KEY = 'gal-portfolio-profile-draft';

export function getBasePath() {
  return document.querySelector('meta[name="base-path"]')?.content || '/';
}

export function asset(path) {
  if (path.startsWith('http') || path.startsWith('mailto:')) return path;
  const base = getBasePath();
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${normalized}`;
}

export async function fetchServerProfile() {
  const base = getBasePath();
  const paths = [
    `${base}data/profile.json`,
    'https://raw.githubusercontent.com/JacobsonGal/JacobsonGal.github.io/main/data/profile.json',
  ];

  for (const path of paths) {
    try {
      const res = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) continue;
      return res.json();
    } catch {
      // try next
    }
  }
  throw new Error('Could not load profile.json');
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function loadProfile({ preferDraft = true } = {}) {
  const server = await fetchServerProfile();
  const draft = loadDraft();

  if (!preferDraft || !draft) return server;

  const draftTime = Date.parse(draft.updatedAt || 0);
  const serverTime = Date.parse(server.syncedAt || 0);
  return draftTime > serverTime ? draft : server;
}

export function downloadJson(profile, filename = 'profile.json') {
  const blob = new Blob([`${JSON.stringify(profile, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
