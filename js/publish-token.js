const STORAGE_KEY = 'portfolio-publish-token';

function readToken() {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim()
      || sessionStorage.getItem(STORAGE_KEY)?.trim()
      || '';
  } catch {
    return '';
  }
}

function writeToken(token) {
  const value = String(token || '').trim();
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
      sessionStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode failures
  }
  return value;
}

/** Stored publish PAT (localStorage so it survives reloads). */
export function getSessionPublishToken() {
  return readToken();
}

export function setSessionPublishToken(token) {
  return writeToken(token);
}

export function clearSessionPublishToken() {
  return writeToken('');
}

export function publishTokenSetupUrl() {
  return 'https://github.com/settings/personal-access-tokens/new';
}

/**
 * Confirm the token can read the profile file on this repo before we save it.
 */
export async function validatePublishToken(token, { owner, repo, path, branch }) {
  const value = String(token || '').trim();
  if (!value) {
    throw new Error('Paste a GitHub fine-grained token first.');
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${value}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Token rejected. Use a fine-grained PAT with Contents: Read and write on this repository.');
  }
  if (response.status === 404) {
    throw new Error(`Could not find ${path} in ${owner}/${repo}. Check token repository access.`);
  }
  if (!response.ok) {
    throw new Error(`GitHub token check failed (${response.status}).`);
  }

  return true;
}
