#!/usr/bin/env bash
set -euo pipefail
cd /home/lily119/doc/the-grind/Courts_Finder/court
CACHE_DIR=scripts/.sitemap-cache
SOURCE=/mnt/c/Users/lily/.cursor/projects/wsl-localhost-Ubuntu-home-lily119-doc-the-grind-Courts-Finder-court/agent-tools/4e3d9c37-95ba-4d1b-88da-42e555941246.txt
API=https://courts.api.theground.io

echo "=== Source file ==="
wc -c "$SOURCE"
echo "--- tail ---"
tail -c 200 "$SOURCE"
echo

echo "=== Current venues.json ==="
wc -c "$CACHE_DIR/venues.json" 2>/dev/null || echo "missing"

mkdir -p "$CACHE_DIR"

SOURCE_SIZE=$(wc -c < "$SOURCE")
if [ -f "$CACHE_DIR/venues.json" ]; then
  CACHE_SIZE=$(wc -c < "$CACHE_DIR/venues.json")
else
  CACHE_SIZE=0
fi

echo "SOURCE_SIZE=$SOURCE_SIZE CACHE_SIZE=$CACHE_SIZE"

echo "=== Fetching from API ==="
curl -sf "$API/api/sports" -o "$CACHE_DIR/sports.json"
curl -sf "$API/api/venues" -o "$CACHE_DIR/venues.json"
echo "Fetched sports: $(wc -c < "$CACHE_DIR/sports.json") bytes"
echo "Fetched venues: $(wc -c < "$CACHE_DIR/venues.json") bytes"

echo "=== JSON parse check ==="
node -e "const v=JSON.parse(require('fs').readFileSync('$CACHE_DIR/venues.json','utf8')); const s=JSON.parse(require('fs').readFileSync('$CACHE_DIR/sports.json','utf8')); console.log('OK venues', v.length, 'sports', s.length);"

echo "=== Generate sitemap ==="
node scripts/generate-sitemap.js --cache-only

echo "=== Sitemap ==="
wc -c public/sitemap.xml
URL_COUNT=$(grep -c '<loc>' public/sitemap.xml || true)
echo "URL_COUNT=$URL_COUNT"
head -n 20 public/sitemap.xml
