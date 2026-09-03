const ALLOWED_ORIGINS = (globalThis.ALLOWED_ORIGINS || 'https://jacobsongal.github.io,http://localhost:8080,http://127.0.0.1:8080')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const ALLOWED_PATHS = new Set([
  '/login/device/code',
  '/login/oauth/access_token',
]);

function corsHeaders(origin) {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return null;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    globalThis.ALLOWED_ORIGINS = env.ALLOWED_ORIGINS || globalThis.ALLOWED_ORIGINS;
    const origin = request.headers.get('Origin');
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      if (!headers) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers });
    }

    if (!headers) {
      return new Response(JSON.stringify({ error: 'forbidden_origin' }), { status: 403 });
    }

    const url = new URL(request.url);
    if (!ALLOWED_PATHS.has(url.pathname)) {
      return new Response(JSON.stringify({ error: 'forbidden_path' }), { status: 403 });
    }

    const githubResponse = await fetch(`https://github.com${url.pathname}`, {
      method: 'POST',
      headers: {
        Accept: request.headers.get('Accept') || 'application/json',
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
      },
      body: await request.text(),
    });

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
