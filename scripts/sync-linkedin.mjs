#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_PATH = join(__dirname, '../data/profile.json');
const LINKEDIN_URL = 'https://www.linkedin.com/in/jacobsongal';

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractMeta(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return null;
}

function parseHeadline(title) {
  if (!title) return null;
  const part = title.split('|')[0]?.trim();
  return part || null;
}

async function main() {
  const profile = JSON.parse(readFileSync(PROFILE_PATH, 'utf8'));

  const res = await fetch(LINKEDIN_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PortfolioBot/1.0; +https://JacobsonGal.github.io/)',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    console.error(`LinkedIn fetch failed: ${res.status}`);
    process.exit(1);
  }

  const html = await res.text();
  const ogTitle = extractMeta(html, 'og:title');
  const ogDescription = extractMeta(html, 'og:description');
  const headline = parseHeadline(ogTitle);

  const next = {
    ...profile,
    syncedAt: new Date().toISOString(),
    source: 'linkedin-action',
  };

  if (headline) next.headline = headline;
  if (ogDescription && ogDescription.length > 40) {
    const intro = ogDescription.split(/\n|•/)[0].trim();
    if (intro) next.about = [intro, ...(profile.about || []).slice(1)];
  }

  writeFileSync(PROFILE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log('Updated profile.json from LinkedIn metadata');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
