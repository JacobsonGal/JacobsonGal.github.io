import { ALLOWED_GITHUB_USERNAME, GITHUB_AUTH_PROXY_URL, GITHUB_CLIENT_ID } from './auth-config.js';
import { clearOwnerSession, getOwnerSession } from './owner-auth.js';

const STORAGE_KEY = 'portfolio_auth_session';
const LEGACY_STORAGE_KEY = 'portfolio_github_session';

function deviceFlowBase() {
  if (GITHUB_AUTH_PROXY_URL) {
    return GITHUB_AUTH_PROXY_URL.replace(/\/$/, '');
  }
  return 'https://github.com';
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
      || sessionStorage.getItem(STORAGE_KEY)
      || localStorage.getItem(LEGACY_STORAGE_KEY)
      || sessionStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  sessionStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_STORAGE_KEY);
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function isAuthConfigured() {
  return Boolean(GITHUB_CLIENT_ID && GITHUB_AUTH_PROXY_URL);
}

export function getStoredSession() {
  return readSession();
}

async function fetchGitHubUser(token) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('GitHub session expired. Sign in again.');
  }

  return response.json();
}

export async function getAuthorizedUser({ forceRefresh = false } = {}) {
  const ownerSession = getOwnerSession();
  if (ownerSession) {
    return {
      login: ownerSession.login,
      method: 'owner',
    };
  }

  if (!GITHUB_CLIENT_ID) return null;

  const session = readSession();
  if (!session?.token) return null;

  if (!forceRefresh && session.login) {
    return session;
  }

  try {
    const user = await fetchGitHubUser(session.token);
    const login = user.login?.toLowerCase();
    if (login !== ALLOWED_GITHUB_USERNAME.toLowerCase()) {
      clearSession();
      return null;
    }

    const nextSession = {
      method: 'github',
      token: session.token,
      login: user.login,
      avatarUrl: user.avatar_url,
    };
    writeSession(nextSession);
    return nextSession;
  } catch {
    clearSession();
    return null;
  }
}

async function postDeviceFlow(path, body) {
  const url = `${deviceFlowBase()}${path}`;
  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (!GITHUB_AUTH_PROXY_URL) {
      throw new Error('GitHub sign-in cannot run directly in the browser. Use owner code unlock, or deploy the GitHub auth proxy.');
    }
    throw new Error(error.message || 'Could not reach the GitHub auth proxy.');
  }

  if (!response.ok) {
    throw new Error('Could not start GitHub sign-in.');
  }

  return response.json();
}

export async function startDeviceFlow() {
  if (!isAuthConfigured()) {
    throw new Error('GitHub sign-in is not configured for browser use yet.');
  }

  return postDeviceFlow('/login/device/code', {
    client_id: GITHUB_CLIENT_ID,
    scope: 'read:user,public_repo',
  });
}

export async function pollDeviceFlow(deviceCode, intervalSeconds = 5) {
  let interval = intervalSeconds;

  while (true) {
    await sleep(interval * 1000);

    const data = await postDeviceFlow('/login/oauth/access_token', {
      client_id: GITHUB_CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    if (data.access_token) {
      const user = await fetchGitHubUser(data.access_token);
      if (user.login?.toLowerCase() !== ALLOWED_GITHUB_USERNAME.toLowerCase()) {
        throw new Error(`Signed in as @${user.login}. Only @${ALLOWED_GITHUB_USERNAME} can edit this resume.`);
      }

      const session = {
        method: 'github',
        token: data.access_token,
        login: user.login,
        avatarUrl: user.avatar_url,
      };
      writeSession(session);
      return session;
    }

    if (data.error === 'authorization_pending') {
      continue;
    }

    if (data.error === 'slow_down') {
      interval += 5;
      continue;
    }

    throw new Error(data.error_description || data.error || 'GitHub sign-in failed.');
  }
}

export function signOut() {
  clearOwnerSession();
  clearSession();
}
