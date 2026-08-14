# Transsion Assignment — Monorepo

Two independent AI-powered web modules, each a Next.js 14 + FastAPI hybrid app, managed as an **npm workspaces** monorepo.

| Module | Description | Frontend | FastAPI |
|--------|-------------|----------|---------|
| **Module 1** — Voice Interview Assistant | Real-time voice interview using Gemini Live | `:3000` | `:8000` |
| **Module 2** — Sentiment Chatbot | Feature-level product review sentiment analysis | `:3001` | `:8001` |

---

## Folder Structure

```
transsion-assignment/
  package.json          ← npm workspaces root + dev scripts
  index.html            ← portal page linking to both modules
  module-1-voice-interview/
    app/                ← Next.js App Router (TypeScript)
    api/                ← FastAPI (Python)
    next.config.js      ← rewrites /api/* → localhost:8000 (local dev)
    vercel.json         ← rewrites /api/* → api/index.py (production)
    package.json
  module-2-sentiment-chatbot/
    app/
    api/
    next.config.js      ← rewrites /api/* → localhost:8001 (local dev)
    vercel.json
    package.json
  node_modules/         ← shared (hoisted by npm workspaces)
  README.md
```

---

## Quick Start (Local Dev)

### 1. Prerequisites

- **Node.js** ≥ 18 + npm
- **Python** ≥ 3.9 + pip
- A **Gemini API key** ([aistudio.google.com](https://aistudio.google.com))

### 2. Install dependencies

```bash
# Node (single install at root — workspaces hoist everything)
npm install

# Python
npm run install:python
# or manually:
pip install -r module-1-voice-interview/api/requirements.txt
pip install -r module-2-sentiment-chatbot/api/requirements.txt
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
npm run dev
```

That's it. This single command starts all four processes:

```
[M1-API] FastAPI → http://localhost:8000
[M1-WEB] Next.js → http://localhost:3000
[M2-API] FastAPI → http://localhost:8001
[M2-WEB] Next.js → http://localhost:3001
```

Press `Ctrl+C` to stop all four.

---

## Available Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Starts all 4 processes (2 × uvicorn + 2 × next dev) |
| `npm run dev:m1-api` | Module 1 FastAPI only (port 8000) |
| `npm run dev:m1-web` | Module 1 Next.js only (port 3000) |
| `npm run dev:m2-api` | Module 2 FastAPI only (port 8001) |
| `npm run dev:m2-web` | Module 2 Next.js only (port 3001) |
| `npm run install:python` | Install Python deps for both modules |
| `npm run build` | Build both Next.js apps for production |

---

## How `/api` Routing Works

| Environment | How `/api/*` is routed |
|-------------|------------------------|
| **Local dev** | `next.config.js` `rewrites()` proxies to uvicorn (`:8000` or `:8001`) |
| **Production (Vercel)** | `vercel.json` rewrites to the FastAPI ASGI app in `api/index.py` |

The frontend always uses **relative `/api/...` paths** — no environment-specific URLs needed.

---

## API Reference

### Module 1 — Voice Interview Assistant

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/token` | Returns a short-lived ephemeral token for Gemini Live |
| `POST` | `/api/summarize` | Accepts `{ transcript: [{role, text}] }`, returns `{ summary, themes }` |

### Module 2 — Sentiment Chatbot

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

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Backend | FastAPI (Python) |
| AI | Google Gemini (`google-generativeai`) |
| Styling | Plain CSS (no framework) |
| Monorepo | npm workspaces + concurrently |
| Local runner | uvicorn + next dev (via `npm run dev`) |
| Production | Vercel (serverless Python + Edge) |
