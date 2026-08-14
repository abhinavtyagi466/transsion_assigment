# TRANSSION Assignment — Build Guide
Module 1: Voice Interview Assistant | Module 2: Sentiment Chatbot

---

## 1. Approach

One monorepo, two independent modules, one root script to run both locally for demo/review. Each module is a self-contained Next.js + Python hybrid app that can also deploy to Vercel independently (two separate Vercel projects, since Vercel doesn't merge two unrelated apps into one deployment — but the root script solves the "run both at once" need for local demoing).

**Hybrid architecture (both modules):**
- **Next.js** → frontend (UI, mic capture / chat interface) + acts as the client
- **Python (FastAPI)** → backend logic, placed in `/api`, auto-mapped by Vercel to serverless functions
- Frontend calls `/api/...` routes like normal REST endpoints — Vercel handles the routing, you don't write a separate Express/Node backend at all

---

## 2. Root Folder Structure

```
transsion-assignment/
│
├── module-1-voice-interview/
│   ├── app/
│   │   ├── page.tsx              # mic UI, connects to Gemini Live via WebSocket
│   │   └── layout.tsx
│   ├── api/
│   │   ├── index.py              # FastAPI app — session init, transcript save, summary
│   │   └── requirements.txt
│   ├── package.json
│   ├── vercel.json
│   └── .env.local.example
│
├── module-2-sentiment-chatbot/
│   ├── app/
│   │   ├── page.tsx              # chat UI
│   │   └── layout.tsx
│   ├── api/
│   │   ├── index.py              # FastAPI app — /analyze endpoint calling Gemini
│   │   └── requirements.txt
│   ├── package.json
│   ├── vercel.json
│   └── .env.local.example
│
├── run-dev.sh                    # boots both modules locally on different ports
└── README.md
```

---

## 3. Step-by-Step Build Prompts

Use these in order with Cursor / Claude Code. Paste one at a time, let it finish, verify, then move to the next.

### Step 1 — Scaffold root + both module folder structures
```
Create a monorepo with this exact structure at the root:

transsion-assignment/
  module-1-voice-interview/
    app/
    api/
  module-2-sentiment-chatbot/
    app/
    api/
  run-dev.sh
  README.md

Inside each module, initialize a Next.js 14 app (App Router, TypeScript) in the
module root (not nested further), and create an empty `api/` folder alongside
`app/` for Python serverless functions. Add a `.gitignore` covering node_modules,
.next, __pycache__, .env.local at the root level.
```

### Step 2 — Module 1 frontend (voice UI)
```
In module-1-voice-interview/app/page.tsx, build a single-page voice interview UI:
- A "Start Interview" button that requests mic permission and opens a WebSocket
  connection to the Gemini Live API (client-side, using an ephemeral token fetched
  from /api/token — do not expose the raw Gemini API key in the browser)
- Show live transcript (user + assistant turns) as they stream in
- A "Stop Interview" button that closes the session and calls /api/summarize
  with the full transcript, then displays the returned summary
- Keep styling minimal — plain CSS, no component library needed for this MVP
```

### Step 3 — Module 1 Python API (FastAPI on Vercel)
```
In module-1-voice-interview/api/index.py, build a FastAPI app with two endpoints:

1. GET /api/token
   - Generates a short-lived ephemeral token for the Gemini Live API using the
     server-side GEMINI_API_KEY (never send the raw key to the client)
   - Returns { "token": "..." }

2. POST /api/summarize
   - Accepts { "transcript": [...] } (array of {role, text} turns)
   - Sends the transcript to Gemini (text model, not Live) with a prompt asking
     for: key themes, notable quotes (paraphrased), and an overall summary
   - Returns structured JSON: { "summary": str, "themes": [str] }

Add api/requirements.txt with: fastapi, google-generativeai
Ensure the FastAPI app object is named `app` so Vercel's Python runtime detects
it as an ASGI app automatically — no manual handler wrapping needed.
```

### Step 4 — Module 1 vercel.json (routing)
```
Create module-1-voice-interview/vercel.json that rewrites all /api/* requests
to the FastAPI app at api/index.py, so Next.js API routes and the Python
backend coexist under the same /api prefix without conflict.
```

### Step 5 — Module 1 frontend↔backend connection check
```
In app/page.tsx, wire the Start Interview button to first call GET /api/token,
use that token to open the Gemini Live WebSocket, and confirm the mic stream
successfully triggers a spoken response from Gemini. Log connection state
(connecting/open/closed/error) visibly in the UI for demo purposes.
```

### Step 6 — Module 2 frontend (chatbot UI)
```
In module-2-sentiment-chatbot/app/page.tsx, build a simple chat interface:
- A textarea where the user pastes/types a product review
- A "Analyze Sentiment" button that POSTs the text to /api/analyze
- Render the response as chat bubbles: show detected aspects (feature name +
  sentiment + short reasoning) in a readable list under the bot's reply
- Keep a running chat history in local component state (no DB needed)
```

### Step 7 — Module 2 Python API (FastAPI on Vercel)
```
In module-2-sentiment-chatbot/api/index.py, build a FastAPI app with one endpoint:

POST /api/analyze
- Accepts { "review_text": str }
- Calls Gemini (gemini-2.5-flash) with response_mime_type "application/json"
  and a response_schema enforcing:
  { "aspects": [{"aspect": str, "sentiment": "positive|negative|neutral",
    "reasoning": str}], "overall_sentiment": str }
- Returns that JSON directly

Add api/requirements.txt with: fastapi, google-generativeai
```

### Step 8 — Module 2 vercel.json + connection check
```
Create module-2-sentiment-chatbot/vercel.json with the same /api rewrite
pattern as module 1. Then wire app/page.tsx's Analyze button to POST to
/api/analyze and confirm the parsed aspects render correctly in the chat UI.
```

### Step 9 — Root run script
```
Create run-dev.sh at the project root that:
- cd's into module-1-voice-interview, runs `vercel dev --listen 3000` in the
  background
- cd's into module-2-sentiment-chatbot, runs `vercel dev --listen 3001` in the
  background
- Prints both URLs once ready
- Traps SIGINT so Ctrl+C kills both processes cleanly

Use `vercel dev` (not `next dev`) since it's the only local runner that also
serves the Python /api functions correctly.
```

---

## 4. run-dev.sh (reference implementation)

```bash
#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo "Stopping both modules..."
  kill "$PID1" "$PID2" 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM

echo "Starting Module 1 (Voice Interview) on http://localhost:3000"
cd "$ROOT_DIR/module-1-voice-interview"
vercel dev --listen 3000 --yes &
PID1=$!

echo "Starting Module 2 (Sentiment Chatbot) on http://localhost:3001"
cd "$ROOT_DIR/module-2-sentiment-chatbot"
vercel dev --listen 3001 --yes &
PID2=$!

echo ""
echo "Module 1: http://localhost:3000"
echo "Module 2: http://localhost:3001"
echo "Press Ctrl+C to stop both."

wait "$PID1" "$PID2"
```

Make it executable: `chmod +x run-dev.sh`, then run `./run-dev.sh` from the root.

**Requires:** `npm i -g vercel` (once), and each module linked to a Vercel project (`vercel link`, run once per module — needed for `vercel dev` to resolve env vars).

---

## 5. Environment Variables (per module)

Each module needs its own `.env.local`:
```
GEMINI_API_KEY=your_key_here
```
Add both as Environment Variables in each module's Vercel project settings before deploying — `vercel dev` picks them up locally via `vercel link` + `vercel env pull`.

---

## 6. Deployment note

Since these are two unrelated apps, deploy them as **two separate Vercel projects** — run `vercel` inside each module folder independently. The root `run-dev.sh` is purely a local convenience for running/demoing both together; it has no bearing on production deployment.
