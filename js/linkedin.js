/**
 * Best-effort LinkedIn refresh on page load.
 * LinkedIn blocks direct browser access (CORS/login wall), so we:
 * 1. Try a read-only proxy for public meta tags (headline/about)
 * 2. Fall back to the committed profile.json (updated by GitHub Actions)
 */

function decodeHtml(text) {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function extractMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return null;
}

function parseHeadlineFromTitle(title) {
  if (!title) return null;
  const parts = title.split('|').map((p) => p.trim());
  if (parts.length >= 2 && parts[0]) return parts[0];
  return null;
}

async function fetchLinkedInHtml(url) {
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function mergeLinkedInProfile(profile, linkedinUrl) {
  const html = await fetchLinkedInHtml(linkedinUrl);
  if (!html) return null;

  const ogTitle = extractMeta(html, 'og:title');
  const ogDescription = extractMeta(html, 'og:description');
  const headline = parseHeadlineFromTitle(ogTitle) || profile.headline;

  const merged = {
    ...profile,
    headline,
    source: 'linkedin-live',
    syncedAt: new Date().toISOString(),
  };

  if (ogDescription && ogDescription.length > 40) {
    const firstParagraph = ogDescription.split(/\n|•/)[0].trim();
    if (firstParagraph) {
      merged.about = [firstParagraph, ...(profile.about || []).slice(1)];
    }
  }

  return merged;
}
