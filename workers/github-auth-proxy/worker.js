const DEFAULT_ALLOWED_ORIGINS = 'https://jacobsongal.github.io,http://localhost:8080,http://127.0.0.1:8080';

const GITHUB_PROXY_PATHS = new Set([
  '/login/device/code',
  '/login/oauth/access_token',
]);

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) {
    return null;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
  };
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function githubRepoConfig(env) {
  return {
    owner: env.GITHUB_REPO_OWNER || 'JacobsonGal',
    repo: env.GITHUB_REPO_NAME || 'JacobsonGal.github.io',
    branch: env.GITHUB_REPO_BRANCH || 'main',
    path: env.PROFILE_PATH || 'data/profile.json',
  };
}

async function githubRequest(env, path, options = {}) {
  if (!env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not configured on the worker.');
  }

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'gal-portfolio-publish-worker',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });

  return response;
}

async function publishProfile(env, profile) {
  const { owner, repo, branch, path } = githubRepoConfig(env);
  const content = `${JSON.stringify(profile, null, 2)}\n`;

  const current = await githubRequest(
    env,
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
  );

  if (!current.ok) {
    const error = await current.text();
    throw new Error(error || 'Could not read profile.json from GitHub.');
  }

  const currentFile = await current.json();
  const update = await githubRequest(env, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Update profile from resume editor',
      content: encodeBase64Utf8(content),
      sha: currentFile.sha,
      branch,
    }),
  });

  if (!update.ok) {
    const error = await update.text();
    throw new Error(error || 'Could not publish profile.json to GitHub.');
  }

  return profile;
}

async function handlePublishProfile(request, env, headers) {
  if (!env.OWNER_UNLOCK_HASH) {
    return new Response(JSON.stringify({ error: 'OWNER_UNLOCK_HASH is not configured on the worker.' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const code = String(body.code || '').trim();
  const profile = body.profile;

  if (!code || !profile || typeof profile !== 'object') {
    return new Response(JSON.stringify({ error: 'missing_code_or_profile' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const hash = await sha256Hex(code);
  if (hash !== env.OWNER_UNLOCK_HASH) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    const published = await publishProfile(env, profile);
    return new Response(JSON.stringify({ ok: true, profile: published }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'publish_failed' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}

async function proxyGithubOAuth(request) {
  const url = new URL(request.url);
  return fetch(`https://github.com${url.pathname}`, {
    method: 'POST',
    headers: {
      Accept: request.headers.get('Accept') || 'application/json',
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
    },
    body: await request.text(),
  });
}

export default {
  async fetch(request, env) {
    const allowedOrigins = getAllowedOrigins(env);
    const origin = request.headers.get('Origin');
    const headers = corsHeaders(origin, allowedOrigins);

    if (request.method === 'OPTIONS') {
      if (!headers) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers });
    }

    if (!headers) {
      return new Response(JSON.stringify({ error: 'forbidden_origin' }), { status: 403 });
    }

    const url = new URL(request.url);

    if (url.pathname === '/publish/profile') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
          status: 405,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
      return handlePublishProfile(request, env, headers);
    }

    if (!GITHUB_PROXY_PATHS.has(url.pathname)) {
      return new Response(JSON.stringify({ error: 'forbidden_path' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const githubResponse = await proxyGithubOAuth(request);
    const body = await githubResponse.text();

    return new Response(body, {
      status: githubResponse.status,
      headers: {
        ...headers,
        'Content-Type': githubResponse.headers.get('Content-Type') || 'application/json',
      },
    });
  },
};
