#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${BLOG_STUDIO_REPO:-/Users/tky/Desktop/blog}"
cd "$REPO"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  set +e
  . "$HOME/.nvm/nvm.sh"
  nvm use --silent >/dev/null 2>&1
  set -e
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node 22.12+ or ensure .nvm/nvm.sh is available." >&2
  exit 1
fi

if [ ! -x node_modules/.bin/astro ]; then
  echo "Installing dependencies..."
  npm ci || npm install
fi

exec ./node_modules/.bin/astro dev --host 127.0.0.1 --port "${BLOG_STUDIO_PORT:-4321}"
