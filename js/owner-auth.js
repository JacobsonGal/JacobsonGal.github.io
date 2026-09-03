import { ALLOWED_GITHUB_USERNAME, OWNER_UNLOCK_HASH } from './auth-config.js';

const STORAGE_KEY = 'portfolio_auth_session';

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isOwnerAuthConfigured() {
  return Boolean(OWNER_UNLOCK_HASH);
}

export function getOwnerSession() {
  const session = readSession();
  if (session?.method !== 'owner') return null;
  return session;
}

export async function unlockWithOwnerCode(code) {
  if (!OWNER_UNLOCK_HASH) {
    throw new Error('Owner unlock is not configured.');
  }

  const normalized = String(code || '').trim();
  if (!normalized) {
    throw new Error('Enter your owner code.');
  }

  const hash = await sha256Hex(normalized);
  if (hash !== OWNER_UNLOCK_HASH) {
    throw new Error('Incorrect owner code.');
  }

  const session = {
    method: 'owner',
    login: ALLOWED_GITHUB_USERNAME,
  };
  writeSession(session);
  return session;
}

export function clearOwnerSession() {
  const session = readSession();
  if (session?.method === 'owner') {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
