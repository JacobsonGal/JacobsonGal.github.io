import { ALLOWED_GITHUB_USERNAME, GITHUB_CLIENT_ID } from './auth-config.js';

const STORAGE_KEY = 'portfolio_github_session';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function isAuthConfigured() {
  return Boolean(GITHUB_CLIENT_ID);
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
  if (!isAuthConfigured()) return null;

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

export async function startDeviceFlow() {
  if (!isAuthConfigured()) {
    throw new Error('GitHub OAuth is not configured yet. Add your Client ID to js/auth-config.js.');
  }

  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user',
    }),
  });

  if (!response.ok) {
    throw new Error('Could not start GitHub sign-in.');
  }

  return response.json();
}

export async function pollDeviceFlow(deviceCode, intervalSeconds = 5) {
  let interval = intervalSeconds;

  while (true) {
    await sleep(interval * 1000);

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = await response.json();

    if (data.access_token) {
      const user = await fetchGitHubUser(data.access_token);
      if (user.login?.toLowerCase() !== ALLOWED_GITHUB_USERNAME.toLowerCase()) {
        throw new Error(`Signed in as @${user.login}. Only @${ALLOWED_GITHUB_USERNAME} can edit this resume.`);
      }

      const session = {
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
  clearSession();
}
