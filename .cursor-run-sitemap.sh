#!/bin/bash
set -eu
export PATH="/home/lily119/.asdf/shims:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
cd /home/lily119/doc/the-grind/Courts_Finder/court
if [ ! -d node_modules/undici ]; then
  npm install
fi
node scripts/generate-sitemap.js --cache-only
