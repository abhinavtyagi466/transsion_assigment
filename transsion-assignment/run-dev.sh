#!/usr/bin/env bash
# run-dev.sh — starts all four local dev processes
#
# Process map:
#   Module 1 FastAPI  → uvicorn api.index:app --reload --port 8000
#   Module 1 Next.js  → next dev -p 3000  (rewrites /api/* → :8000)
#   Module 2 FastAPI  → uvicorn api.index:app --reload --port 8001
#   Module 2 Next.js  → next dev -p 3001  (rewrites /api/* → :8001)
#
# Prerequisites:
#   - Python (≥3.9) with pip
#   - Node.js (≥18) with npm
#   - pip install -r module-1-voice-interview/api/requirements.txt
#   - pip install -r module-2-sentiment-chatbot/api/requirements.txt
#   - npm install inside each module (or run this script once — npm install
#     is triggered automatically if node_modules is missing)
#   - Each module must have a .env.local file with GEMINI_API_KEY=...

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colour helpers ────────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colour

# ── Cleanup on exit ───────────────────────────────────────────────────────────
PID1="" PID2="" PID3="" PID4=""
cleanup() {
  echo ""
  echo "Stopping all processes…"
  # Kill each PID if it was set and is still running
  for pid in "$PID1" "$PID2" "$PID3" "$PID4"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  echo "All stopped. Goodbye."
}
trap cleanup SIGINT SIGTERM EXIT

# ── Ensure .env.local files exist ─────────────────────────────────────────────
for module in module-1-voice-interview module-2-sentiment-chatbot; do
  if [ ! -f "$ROOT_DIR/$module/.env.local" ]; then
    echo -e "${YELLOW}WARNING: $module/.env.local not found.${NC}"
    echo "  Copy $module/.env.local.example to $module/.env.local and add your GEMINI_API_KEY."
    echo ""
  fi
done

# ── Module 1 — FastAPI (uvicorn, port 8000) ───────────────────────────────────
echo -e "${CYAN}[Module 1]${NC} Starting FastAPI on http://localhost:8000"
cd "$ROOT_DIR/module-1-voice-interview"
# Load env vars from .env.local for the Python process
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi
uvicorn api.index:app --reload --port 8000 &
PID1=$!

# ── Module 1 — Next.js (port 3000) ───────────────────────────────────────────
echo -e "${CYAN}[Module 1]${NC} Starting Next.js on http://localhost:3000"
cd "$ROOT_DIR/module-1-voice-interview"
npm run dev &
PID2=$!

# ── Module 2 — FastAPI (uvicorn, port 8001) ───────────────────────────────────
echo -e "${CYAN}[Module 2]${NC} Starting FastAPI on http://localhost:8001"
cd "$ROOT_DIR/module-2-sentiment-chatbot"
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi
uvicorn api.index:app --reload --port 8001 &
PID3=$!

# ── Module 2 — Next.js (port 3001) ───────────────────────────────────────────
echo -e "${CYAN}[Module 2]${NC} Starting Next.js on http://localhost:3001"
cd "$ROOT_DIR/module-2-sentiment-chatbot"
npm run dev &
PID4=$!

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  All four processes started.${NC}"
echo ""
echo -e "  ${CYAN}Module 1 — Voice Interview Assistant${NC}"
echo    "    Frontend :  http://localhost:3000"
echo    "    FastAPI  :  http://localhost:8000"
echo ""
echo -e "  ${CYAN}Module 2 — Sentiment Chatbot${NC}"
echo    "    Frontend :  http://localhost:3001"
echo    "    FastAPI  :  http://localhost:8001"
echo ""
echo    "  Press Ctrl+C to stop all processes."
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Wait for all background processes
wait "$PID1" "$PID2" "$PID3" "$PID4"
