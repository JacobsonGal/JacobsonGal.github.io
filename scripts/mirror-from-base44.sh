#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT"
BASE_URL="${BASE_URL:-https://jacobsongal.base44.app}"
CV_SOURCE="${CV_SOURCE:-$HOME/Downloads/Gal Jacobson _ CV.pdf}"

mkdir -p "$SITE/assets" "$SITE/cv"

echo "Mirroring $BASE_URL → $SITE"
curl -fsSL "$BASE_URL/" -o "$SITE/index.html.raw"
curl -fsSL "$BASE_URL/manifest.json" -o "$SITE/manifest.json"

JS_PATH=$(grep -oE 'src="/assets/[^"]+\.js"' "$SITE/index.html.raw" | head -1 | sed 's/src="//;s/"//')
CSS_PATH=$(grep -oE 'href="/assets/[^"]+\.css"' "$SITE/index.html.raw" | head -1 | sed 's/href="//;s/"//')

curl -fsSL "$BASE_URL$JS_PATH" -o "$SITE$JS_PATH"
curl -fsSL "$BASE_URL$CSS_PATH" -o "$SITE$CSS_PATH"

if [[ -f "$CV_SOURCE" ]]; then
  cp "$CV_SOURCE" "$SITE/cv/gal-jacobson-cv.pdf"
else
  echo "Warning: CV not found at $CV_SOURCE"
fi

# Preserve patched index.html and site-patch.js — only refresh asset hashes if needed.
echo "Done. Review index.html patches before commit (badge removal, title, site-patch.js)."
