import {
  GITHUB_AUTH_PROXY_URL,
  GITHUB_PROFILE_PATH,
  GITHUB_REPO,
} from './auth-config.js';
import { getAuthorizedUser } from './github-auth.js';
import { getOwnerCodeForPublish } from './owner-auth.js';
import { getSessionPublishToken } from './publish-token.js';

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

/** True when a proxy is deployed — owner-code publish can work without a PAT. */
export function isProxyPublishConfigured() {
  return Boolean(GITHUB_AUTH_PROXY_URL);
}

/**
 * Publish is always available to authenticated owners: via proxy, GitHub sign-in,
 * or a fine-grained PAT stored for this browser session.
 */
export function isPublishConfigured() {
  return true;
}

export function prepareProfileForPublish(profile) {
  const overview = profile.resume?.overview || profile.about || [];
  const syncedAt = new Date().toISOString();
  return {
    ...profile,
    updatedAt: syncedAt,
    syncedAt,
    about: overview.length ? overview : profile.about,
  };
}

async function readGithubError(response) {
  try {
    const data = await response.json();
    return data.message || data.error || `GitHub request failed (${response.status}).`;
  } catch {
    return `GitHub request failed (${response.status}).`;
  }
}

async function getProfileFileSha(token) {
  const url = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/contents/${GITHUB_PROFILE_PATH}?ref=${GITHUB_REPO.branch}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(await readGithubError(response));
  }

  const data = await response.json();
  return data.sha;
}

async function publishWithToken(profile, token) {
  const payload = prepareProfileForPublish(profile);
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  const sha = await getProfileFileSha(token);
  const url = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.name}/contents/${GITHUB_PROFILE_PATH}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: 'Update profile from resume editor',
      content: encodeBase64Utf8(content),
      sha,
      branch: GITHUB_REPO.branch,
    }),
  });

  if (!response.ok) {
    throw new Error(await readGithubError(response));
  }

  return payload;
}

async function publishWithOwnerCode(profile, ownerCode) {
  const base = GITHUB_AUTH_PROXY_URL.replace(/\/$/, '');
  const response = await fetch(`${base}/publish/profile`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: ownerCode,
      profile: prepareProfileForPublish(profile),
    }),
  });

  if (!response.ok) {
    throw new Error(await readGithubError(response));
  }

  const data = await response.json();
  return data.profile || prepareProfileForPublish(profile);
}

export class PublishAuthRequiredError extends Error {
  constructor(message) {
    super(message || 'A GitHub publish token is required.');
    this.name = 'PublishAuthRequiredError';
    this.code = 'publish_auth_required';
  }
}

export async function publishProfile(profile) {
  const user = await getAuthorizedUser();
  if (user?.token) {
    return publishWithToken(profile, user.token);
  }

  const sessionToken = getSessionPublishToken();
  if (sessionToken) {
    return publishWithToken(profile, sessionToken);
  }

  const ownerCode = getOwnerCodeForPublish();
  if (ownerCode && GITHUB_AUTH_PROXY_URL) {
    return publishWithOwnerCode(profile, ownerCode);
  }

  if (ownerCode && !GITHUB_AUTH_PROXY_URL) {
    throw new PublishAuthRequiredError(
      'Add a GitHub token once to publish live. Create a fine-grained token with Contents: Read and write on this repo, then paste it below.',
    );
  }

  throw new Error('Sign in with GitHub or unlock with your owner code to publish.');
}
