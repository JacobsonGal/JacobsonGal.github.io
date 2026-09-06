/**
 * Portfolio admin + auth proxy worker.
 * Bindings: ADMIN_KV (KV), secrets: GITHUB_TOKEN, OWNER_UNLOCK_HASH,
 * optional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 */

const DEFAULT_ALLOWED_ORIGINS =
  'https://jacobsongal.github.io,http://localhost:8080,http://127.0.0.1:8080,http://localhost:8766,http://127.0.0.1:8766';

const GITHUB_PROXY_PATHS = new Set(['/login/device/code', '/login/oauth/access_token']);
const APPLICATION_STAGES = ['wishlist', 'applied', 'interview', 'offer', 'rejected', 'ghosted'];

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Owner-Code, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
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

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(date = new Date()) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay();
  const diff = (weekday + 6) % 7;
  day.setUTCDate(day.getUTCDate() - diff);
  return day;
}

function weekDayKeys(date = new Date()) {
  const start = startOfUtcWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setUTCDate(start.getUTCDate() + index);
    return utcDayKey(next);
  });
}

function emptyDayStats() {
  return { pageviews: 0, visitorIds: [] };
}

function applyHit(dayStats, visitorId) {
  const next = {
    pageviews: Number(dayStats?.pageviews || 0) + 1,
    visitorIds: Array.isArray(dayStats?.visitorIds) ? [...dayStats.visitorIds] : [],
  };
  if (visitorId && !next.visitorIds.includes(visitorId)) next.visitorIds.push(visitorId);
  return next;
}

function summarizeDays(dayMap, keys) {
  let pageviews = 0;
  const uniques = new Set();
  keys.forEach((key) => {
    const day = dayMap[key] || emptyDayStats();
    pageviews += Number(day.pageviews || 0);
    (day.visitorIds || []).forEach((id) => uniques.add(id));
  });
  return { pageviews, uniques: uniques.size };
}

function buildStatsPayload(dayMap, allTime, now = new Date()) {
  return {
    today: summarizeDays(dayMap, [utcDayKey(now)]),
    week: summarizeDays(dayMap, weekDayKeys(now)),
    all: {
      pageviews: Number(allTime?.pageviews || 0),
      uniques: Number(allTime?.uniques || 0),
    },
    generatedAt: now.toISOString(),
  };
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function createCampaign(input = {}) {
  const now = new Date().toISOString();
  return {
    id: createId('camp'),
    name: String(input.name || 'Untitled search').trim() || 'Untitled search',
    status: input.status === 'archived' ? 'archived' : 'active',
    createdAt: now,
    updatedAt: now,
  };
}

function createApplication(input = {}) {
  const now = new Date().toISOString();
  const stage = APPLICATION_STAGES.includes(input.stage) ? input.stage : 'wishlist';
  return {
    id: createId('app'),
    company: String(input.company || '').trim() || 'Company',
    role: String(input.role || '').trim() || 'Role',
    location: String(input.location || '').trim(),
    url: String(input.url || '').trim(),
    stage,
    notes: String(input.notes || '').trim(),
    interviewAt: input.interviewAt || null,
    calendarEventId: input.calendarEventId || null,
    emails: Array.isArray(input.emails) ? input.emails : [],
    createdAt: now,
    updatedAt: now,
  };
}

async function kvGetJson(kv, key, fallback) {
  if (!kv) return fallback;
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function kvPutJson(kv, key, value) {
  if (!kv) throw new Error('ADMIN_KV binding is missing. Create a KV namespace and bind it as ADMIN_KV.');
  await kv.put(key, JSON.stringify(value));
}

async function readOwnerCode(request) {
  const headerCode = request.headers.get('X-Owner-Code') || '';
  if (headerCode.trim()) return headerCode.trim();
  if (request.method === 'GET' || request.method === 'HEAD') return '';
  try {
    const body = await request.clone().json();
    return String(body?.code || '').trim();
  } catch {
    return '';
  }
}

async function requireOwner(request, env, headers) {
  if (!env.OWNER_UNLOCK_HASH) {
    return { error: json({ error: 'OWNER_UNLOCK_HASH is not configured on the worker.' }, 500, headers) };
  }
  const code = await readOwnerCode(request);
  if (!code) return { error: json({ error: 'unauthorized' }, 401, headers) };
  const hash = await sha256Hex(code);
  if (hash !== env.OWNER_UNLOCK_HASH) return { error: json({ error: 'unauthorized' }, 401, headers) };
  return { code };
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
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured on the worker.');
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'gal-portfolio-admin-worker',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
}

async function publishProfile(env, profile) {
  const { owner, repo, branch, path } = githubRepoConfig(env);
  const content = `${JSON.stringify(profile, null, 2)}\n`;
  const current = await githubRequest(
    env,
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
  );
  if (!current.ok) throw new Error((await current.text()) || 'Could not read profile.json from GitHub.');
  const currentFile = await current.json();
  const update = await githubRequest(env, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Update profile from resume editor',
      content: encodeBase64Utf8(content),
      sha: currentFile.sha,
      branch,
    }),
  });
  if (!update.ok) throw new Error((await update.text()) || 'Could not publish profile.json to GitHub.');
  return profile;
}

async function handlePublishProfile(request, env, headers) {
  const auth = await requireOwner(request, env, headers);
  if (auth.error) return auth.error;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, headers);
  }
  if (!body.profile || typeof body.profile !== 'object') {
    return json({ error: 'missing_profile' }, 400, headers);
  }
  try {
    const published = await publishProfile(env, body.profile);
    return json({ ok: true, profile: published }, 200, headers);
  } catch (error) {
    return json({ error: error.message || 'publish_failed' }, 500, headers);
  }
}

async function handleAnalyticsHit(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, headers);
  }
  if (body?.owner === true) return json({ ok: true, skipped: 'owner' }, 200, headers);

  const visitorId = String(body.visitorId || '').slice(0, 80);
  if (!visitorId) return json({ error: 'missing_visitor' }, 400, headers);

  const dayKey = utcDayKey();
  const dayStoreKey = `analytics:day:${dayKey}`;
  const day = applyHit(await kvGetJson(env.ADMIN_KV, dayStoreKey, emptyDayStats()), visitorId);
  await kvPutJson(env.ADMIN_KV, dayStoreKey, day);

  const all = await kvGetJson(env.ADMIN_KV, 'analytics:all', { pageviews: 0, uniques: 0, visitorIds: [] });
  const nextAll = {
    pageviews: Number(all.pageviews || 0) + 1,
    uniques: Number(all.uniques || 0),
    visitorIds: Array.isArray(all.visitorIds) ? [...all.visitorIds] : [],
  };
  if (!nextAll.visitorIds.includes(visitorId)) {
    nextAll.visitorIds.push(visitorId);
    nextAll.uniques = nextAll.visitorIds.length;
  }
  if (nextAll.visitorIds.length > 5000) nextAll.visitorIds = nextAll.visitorIds.slice(-4000);
  await kvPutJson(env.ADMIN_KV, 'analytics:all', nextAll);
  return json({ ok: true }, 200, headers);
}

async function handleAnalyticsStats(request, env, headers) {
  const auth = await requireOwner(request, env, headers);
  if (auth.error) return auth.error;

  const all = await kvGetJson(env.ADMIN_KV, 'analytics:all', { pageviews: 0, uniques: 0 });
  const dayMap = {};
  for (let i = 0; i < 8; i += 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    const key = utcDayKey(date);
    dayMap[key] = await kvGetJson(env.ADMIN_KV, `analytics:day:${key}`, emptyDayStats());
  }
  return json(buildStatsPayload(dayMap, all), 200, headers);
}

async function handleJobs(request, env, headers, url) {
  const auth = await requireOwner(request, env, headers);
  if (auth.error) return auth.error;

  const parts = url.pathname.split('/').filter(Boolean);

  if (parts[0] === 'jobs' && parts[1] === 'campaigns' && parts.length === 2) {
    if (request.method === 'GET') {
      return json({ campaigns: await kvGetJson(env.ADMIN_KV, 'jobs:campaigns', []) }, 200, headers);
    }
    if (request.method === 'POST') {
      const body = await request.json();
      const campaign = createCampaign(body);
      const campaigns = await kvGetJson(env.ADMIN_KV, 'jobs:campaigns', []);
      campaigns.unshift(campaign);
      await kvPutJson(env.ADMIN_KV, 'jobs:campaigns', campaigns);
      await kvPutJson(env.ADMIN_KV, `jobs:apps:${campaign.id}`, []);
      return json({ campaign }, 201, headers);
    }
    return json({ error: 'method_not_allowed' }, 405, headers);
  }

  if (parts[0] === 'jobs' && parts[1] === 'campaigns' && parts.length === 3) {
    const campaignId = parts[2];
    const campaigns = await kvGetJson(env.ADMIN_KV, 'jobs:campaigns', []);
    const index = campaigns.findIndex((item) => item.id === campaignId);
    if (index === -1) return json({ error: 'not_found' }, 404, headers);

    if (request.method === 'GET') {
      const applications = await kvGetJson(env.ADMIN_KV, `jobs:apps:${campaignId}`, []);
      return json({ campaign: campaigns[index], applications }, 200, headers);
    }
    if (request.method === 'PATCH') {
      const body = await request.json();
      const current = campaigns[index];
      campaigns[index] = {
        ...current,
        name: body.name != null ? String(body.name).trim() || current.name : current.name,
        status: body.status === 'archived' ? 'archived' : body.status === 'active' ? 'active' : current.status,
        updatedAt: new Date().toISOString(),
      };
      await kvPutJson(env.ADMIN_KV, 'jobs:campaigns', campaigns);
      return json({ campaign: campaigns[index] }, 200, headers);
    }
    if (request.method === 'DELETE') {
      campaigns.splice(index, 1);
      await kvPutJson(env.ADMIN_KV, 'jobs:campaigns', campaigns);
      await env.ADMIN_KV.delete(`jobs:apps:${campaignId}`);
      return json({ ok: true }, 200, headers);
    }
    return json({ error: 'method_not_allowed' }, 405, headers);
  }

  if (parts[0] === 'jobs' && parts[1] === 'campaigns' && parts[3] === 'applications' && parts.length === 4) {
    const campaignId = parts[2];
    const campaigns = await kvGetJson(env.ADMIN_KV, 'jobs:campaigns', []);
    if (!campaigns.some((item) => item.id === campaignId)) return json({ error: 'not_found' }, 404, headers);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);
    const body = await request.json();
    const application = createApplication(body);
    const applications = await kvGetJson(env.ADMIN_KV, `jobs:apps:${campaignId}`, []);
    applications.unshift(application);
    await kvPutJson(env.ADMIN_KV, `jobs:apps:${campaignId}`, applications);
    return json({ application }, 201, headers);
  }

  if (parts[0] === 'jobs' && parts[1] === 'campaigns' && parts[3] === 'applications' && parts.length === 5) {
    const campaignId = parts[2];
    const appId = parts[4];
    const applications = await kvGetJson(env.ADMIN_KV, `jobs:apps:${campaignId}`, []);
    const index = applications.findIndex((item) => item.id === appId);
    if (index === -1) return json({ error: 'not_found' }, 404, headers);

    if (request.method === 'PATCH') {
      const body = await request.json();
      let application = { ...applications[index] };
      if (body.stage && APPLICATION_STAGES.includes(body.stage)) {
        application.stage = body.stage;
      }
      ['company', 'role', 'location', 'url', 'notes', 'interviewAt', 'calendarEventId'].forEach((key) => {
        if (body[key] !== undefined) application[key] = body[key];
      });
      if (Array.isArray(body.emails)) application.emails = body.emails;
      application.updatedAt = new Date().toISOString();
      applications[index] = application;
      await kvPutJson(env.ADMIN_KV, `jobs:apps:${campaignId}`, applications);
      return json({ application }, 200, headers);
    }
    if (request.method === 'DELETE') {
      applications.splice(index, 1);
      await kvPutJson(env.ADMIN_KV, `jobs:apps:${campaignId}`, applications);
      return json({ ok: true }, 200, headers);
    }
    return json({ error: 'method_not_allowed' }, 405, headers);
  }

  return json({ error: 'not_found' }, 404, headers);
}

async function ensureGoogleAccessToken(env, tokens) {
  const expiresAt = Number(tokens.expires_at || 0);
  if (tokens.access_token && Date.now() < expiresAt - 60_000) return tokens.access_token;
  if (!tokens.refresh_token) return tokens.access_token;

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const refreshed = await refreshRes.json();
  if (!refreshRes.ok) throw new Error(refreshed.error || 'google_refresh_failed');
  const next = {
    ...tokens,
    ...refreshed,
    refresh_token: refreshed.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
    updatedAt: new Date().toISOString(),
  };
  await kvPutJson(env.ADMIN_KV, 'google:tokens', next);
  return next.access_token;
}

async function handleGoogle(request, env, headers, url) {
  if (url.pathname === '/google/oauth/callback' && request.method === 'GET') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return new Response('Google OAuth is not configured.', { status: 501 });
    }
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const redirectUri = env.GOOGLE_REDIRECT_URI || `${url.origin}/google/oauth/callback`;
    if (!code || !state) return new Response('Missing code/state', { status: 400 });
    const stateRow = await kvGetJson(env.ADMIN_KV, `google:oauth:${state}`, null);
    if (!stateRow) return new Response('Invalid state', { status: 400 });
    await env.ADMIN_KV.delete(`google:oauth:${state}`);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) return new Response(`Token exchange failed: ${tokenJson.error || tokenRes.status}`, { status: 500 });

    let email = null;
    try {
      const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (infoRes.ok) email = (await infoRes.json()).email || null;
    } catch {
      // optional
    }

    await kvPutJson(env.ADMIN_KV, 'google:tokens', {
      ...tokenJson,
      email,
      expires_at: Date.now() + Number(tokenJson.expires_in || 3600) * 1000,
      updatedAt: new Date().toISOString(),
    });
    const site = env.ADMIN_SITE_URL || 'https://jacobsongal.github.io';
    return Response.redirect(`${site.replace(/\/$/, '')}/admin.html?google=connected#jobs`, 302);
  }

  const auth = await requireOwner(request, env, headers);
  if (auth.error) return auth.error;

  if (url.pathname === '/google/status' && request.method === 'GET') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return json({ configured: false, connected: false, email: null }, 200, headers);
    }
    const tokens = await kvGetJson(env.ADMIN_KV, 'google:tokens', null);
    return json({
      configured: true,
      connected: Boolean(tokens?.refresh_token || tokens?.access_token),
      email: tokens?.email || null,
    }, 200, headers);
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({
      error: 'google_not_configured',
      message: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets to enable Gmail/Calendar.',
    }, 501, headers);
  }

  if (url.pathname === '/google/oauth/start' && request.method === 'POST') {
    const redirectUri = env.GOOGLE_REDIRECT_URI || `${url.origin}/google/oauth/callback`;
    const state = crypto.randomUUID();
    await kvPutJson(env.ADMIN_KV, `google:oauth:${state}`, { createdAt: Date.now() });
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'openid',
        'email',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ].join(' '),
      state,
    });
    return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }, 200, headers);
  }

  if (url.pathname === '/google/disconnect' && request.method === 'POST') {
    await env.ADMIN_KV.delete('google:tokens');
    return json({ ok: true }, 200, headers);
  }

  if (url.pathname === '/google/gmail/sync' && request.method === 'POST') {
    const tokens = await kvGetJson(env.ADMIN_KV, 'google:tokens', null);
    if (!tokens?.access_token && !tokens?.refresh_token) {
      return json({ error: 'google_not_connected' }, 400, headers);
    }
    const accessToken = await ensureGoogleAccessToken(env, tokens);
    const query = encodeURIComponent(
      'newer_than:21d (interview OR recruiting OR application OR "thank you for applying" OR Greenhouse OR Lever OR Ashby)',
    );
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=25`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) return json({ error: 'gmail_list_failed', detail: await listRes.text() }, 502, headers);
    const list = await listRes.json();
    const messages = [];
    for (const item of list.messages || []) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();
      const headerMap = Object.fromEntries((msg.payload?.headers || []).map((header) => [header.name, header.value]));
      messages.push({
        id: msg.id,
        threadId: msg.threadId,
        subject: headerMap.Subject || '(no subject)',
        from: headerMap.From || '',
        date: headerMap.Date || '',
        snippet: msg.snippet || '',
        gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
      });
    }
    return json({ messages }, 200, headers);
  }

  if (url.pathname === '/google/calendar/event' && request.method === 'POST') {
    const tokens = await kvGetJson(env.ADMIN_KV, 'google:tokens', null);
    if (!tokens?.access_token && !tokens?.refresh_token) {
      return json({ error: 'google_not_connected' }, 400, headers);
    }
    const body = await request.json();
    const accessToken = await ensureGoogleAccessToken(env, tokens);
    const start = new Date(body.start);
    const end = new Date(body.end || start.getTime() + 60 * 60 * 1000);
    const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: body.title || 'Interview',
        description: body.description || '',
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    });
    const calJson = await calRes.json();
    if (!calRes.ok) return json({ error: 'calendar_create_failed', detail: calJson }, 502, headers);
    return json({ event: calJson }, 201, headers);
  }

  return json({ error: 'not_found' }, 404, headers);
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
    const url = new URL(request.url);
    const allowedOrigins = getAllowedOrigins(env);
    const origin = request.headers.get('Origin');

    if (url.pathname === '/google/oauth/callback' && request.method === 'GET') {
      return handleGoogle(request, env, {}, url);
    }

    const headers = corsHeaders(origin, allowedOrigins);
    if (request.method === 'OPTIONS') {
      if (!headers) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers });
    }
    if (!headers) return json({ error: 'forbidden_origin' }, 403, {});

    if (url.pathname === '/publish/profile' && request.method === 'POST') {
      return handlePublishProfile(request, env, headers);
    }
    if (url.pathname === '/analytics/hit' && request.method === 'POST') {
      return handleAnalyticsHit(request, env, headers);
    }
    if (url.pathname === '/analytics/stats' && request.method === 'GET') {
      return handleAnalyticsStats(request, env, headers);
    }
    if (url.pathname.startsWith('/jobs/')) {
      return handleJobs(request, env, headers, url);
    }
    if (url.pathname.startsWith('/google/')) {
      return handleGoogle(request, env, headers, url);
    }
    if (!GITHUB_PROXY_PATHS.has(url.pathname)) {
      return json({ error: 'forbidden_path' }, 403, headers);
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
