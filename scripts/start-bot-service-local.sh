#!/usr/bin/env bash
# Start the trackd-search microservice locally for development/testing.
# Assumes the repo is cloned at ../trackd-search (sibling of this repo).
set -euo pipefail

SEARCH_DIR="$(cd "$(dirname "$0")/../../trackd-search" 2>/dev/null && pwd)" || {
  echo "❌  trackd-search not found at ../trackd-search"
  echo "   Clone it: git clone https://github.com/itsyuvallavi/trackd-search ../trackd-search"
  exit 1
}

echo "📁 Found trackd-search at: $SEARCH_DIR"

# Create virtualenv if needed
VENV="$SEARCH_DIR/.venv"
if [ ! -d "$VENV" ]; then
  echo "🐍 Creating virtualenv..."
  python3 -m venv "$VENV"
fi

source "$VENV/bin/activate"

echo "📦 Installing dependencies..."
pip install -q -r "$SEARCH_DIR/requirements.txt"

# Copy .env if it exists
if [ -f "$SEARCH_DIR/.env" ]; then
  echo "✅ Using $SEARCH_DIR/.env"
else
  echo "⚠️  No .env found — copy .env.example and fill in values:"
  echo "   cp $SEARCH_DIR/.env.example $SEARCH_DIR/.env"
fi

echo ""
echo "🚀 Starting trackd-search on http://localhost:8000"
echo "   Docs: http://localhost:8000/docs"
echo "   Press Ctrl+C to stop"
echo ""

cd "$SEARCH_DIR"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
