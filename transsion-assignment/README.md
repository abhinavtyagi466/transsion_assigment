# Transsion Assignment — Monorepo

Two independent AI-powered web modules, each a Next.js 14 + FastAPI hybrid app.

| Module | Description | Frontend | FastAPI |
|--------|-------------|----------|---------|
| **Module 1** — Voice Interview Assistant | Real-time voice interview using Gemini Live | `:3000` | `:8000` |
| **Module 2** — Sentiment Chatbot | Feature-level product review sentiment analysis | `:3001` | `:8001` |

---

## Folder Structure

```
transsion-assignment/
  module-1-voice-interview/
    app/            ← Next.js App Router (TypeScript)
    api/            ← FastAPI (Python)
    next.config.js  ← rewrites /api/* → localhost:8000 (local dev)
    vercel.json     ← rewrites /api/* → api/index.py (production)
  module-2-sentiment-chatbot/
    app/
    api/
    next.config.js  ← rewrites /api/* → localhost:8001 (local dev)
    vercel.json
  run-dev.sh        ← starts all 4 processes locally
  README.md
```

---

## Quick Start (Local Dev)

### 1. Prerequisites

- **Node.js** ≥ 18 + npm
- **Python** ≥ 3.9 + pip
- A **Gemini API key** (get one at [aistudio.google.com](https://aistudio.google.com))

### 2. Install dependencies

```bash
# Python (run once per module, or share a venv)
pip install -r module-1-voice-interview/api/requirements.txt
pip install -r module-2-sentiment-chatbot/api/requirements.txt

# Node
cd module-1-voice-interview && npm install && cd ..
cd module-2-sentiment-chatbot && npm install && cd ..
```

### 3. Set up environment variables

Each module needs its own `.env.local`:

```bash
# Module 1
cp module-1-voice-interview/.env.local.example module-1-voice-interview/.env.local
# Edit and set: GEMINI_API_KEY=your_key_here

# Module 2
cp module-2-sentiment-chatbot/.env.local.example module-2-sentiment-chatbot/.env.local
# Edit and set: GEMINI_API_KEY=your_key_here
```

> **Note**: The key is **never** sent to the browser. Module 1 uses it server-side
> to generate short-lived ephemeral tokens for Gemini Live. Module 2 uses it
> to call the Gemini text model directly from the FastAPI server.

### 4. Run everything

```bash
chmod +x run-dev.sh
./run-dev.sh
```

This starts four processes and prints:

```
Module 1 — Voice Interview Assistant
  Frontend :  http://localhost:3000
  FastAPI  :  http://localhost:8000

Module 2 — Sentiment Chatbot
  Frontend :  http://localhost:3001
  FastAPI  :  http://localhost:8001
```

Press `Ctrl+C` to stop all four.

---

## Running Modules Individually

**Module 1:**
```bash
# Terminal 1 — FastAPI
cd module-1-voice-interview
uvicorn api.index:app --reload --port 8000

# Terminal 2 — Next.js
cd module-1-voice-interview
npm run dev   # → http://localhost:3000
```

**Module 2:**
```bash
# Terminal 1 — FastAPI
cd module-2-sentiment-chatbot
uvicorn api.index:app --reload --port 8001

# Terminal 2 — Next.js
cd module-2-sentiment-chatbot
npm run dev   # → http://localhost:3001
```

---

## How `/api` routing works

| Environment | How `/api/*` is routed |
|-------------|------------------------|
| **Local dev** | `next.config.js` `rewrites()` proxies to uvicorn (`:8000` or `:8001`) |
| **Production (Vercel)** | `vercel.json` rewrites to the FastAPI ASGI app in `api/index.py` |

The frontend always uses **relative `/api/...` paths** — no environment-specific URLs in the frontend code.

---

## API Reference

### Module 1

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/token` | Returns a short-lived ephemeral token for Gemini Live |
| `POST` | `/api/summarize` | Accepts `{ transcript: [{role, text}] }`, returns `{ summary, themes }` |

### Module 2

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/analyze` | Accepts `{ review_text: str }`, returns `{ aspects: [{aspect, sentiment, reasoning}], overall_sentiment }` |

---

## Production Deployment (Vercel)

Deploy each module as a **separate Vercel project**:

```bash
cd module-1-voice-interview
vercel   # follow prompts, add GEMINI_API_KEY in Vercel dashboard

cd module-2-sentiment-chatbot
vercel   # same steps
```

The `run-dev.sh` script is for local development only and has no effect on production.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Backend | FastAPI (Python) |
| AI | Google Gemini (`google-generativeai`) |
| Styling | Plain CSS (no framework) |
| Local runner | uvicorn + next dev |
| Production | Vercel (serverless Python + Edge) |
