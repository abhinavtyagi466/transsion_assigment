"""
Module 1 — Voice Interview Assistant — FastAPI backend

Endpoints:
  GET  /api/token      → short-lived ephemeral token for Gemini Live
  POST /api/summarize  → Gemini text summary of interview transcript

Run locally:
  uvicorn api.index:app --reload --port 8000
"""

import os
import json
import logging
from typing import List

import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(title="Voice Interview API", version="1.0.0")

# Allow Next.js dev server to call this API (local dev only — Vercel handles
# routing in production, so CORS is not needed there)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ── Gemini client initialisation ─────────────────────────────────────────────
def _get_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set.",
        )
    return key


# ── Schemas ───────────────────────────────────────────────────────────────────
class TranscriptTurn(BaseModel):
    role: str   # "user" | "assistant"
    text: str


class SummarizeRequest(BaseModel):
    transcript: List[TranscriptTurn]


# ── GET /api/token ────────────────────────────────────────────────────────────
@app.get("/api/token")
async def get_token():
    """
    Returns a short-lived ephemeral token for the Gemini Live API.
    The raw GEMINI_API_KEY is never sent to the browser — only this token.

    Gemini Live token generation uses the REST endpoint:
      POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateToken
    We call it server-side and return only the token string.
    """
    import urllib.request
    import urllib.error

    api_key = _get_api_key()
    model = "models/gemini-2.0-flash-live-001"

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/{model}"
        f":generateEphemeralToken?key={api_key}"
    )
    payload = json.dumps(
        {
            "ttl": "3600s",  # 1-hour token — sufficient for a demo session
            "new_session": {"model": model},
        }
    ).encode()

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read())
            token = body.get("token") or body.get("ephemeralToken")
            if not token:
                logger.error("Unexpected token response: %s", body)
                raise HTTPException(
                    status_code=502,
                    detail=f"Gemini did not return a token. Response: {body}",
                )
            return {"token": token}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        logger.error("Gemini token error %s: %s", exc.code, detail)
        raise HTTPException(status_code=exc.code, detail=detail) from exc
    except Exception as exc:
        logger.exception("Unexpected error fetching token")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ── POST /api/summarize ───────────────────────────────────────────────────────
@app.post("/api/summarize")
async def summarize(body: SummarizeRequest):
    """
    Accepts a list of {role, text} transcript turns.
    Sends them to Gemini (text model) and returns:
      { "summary": str, "themes": [str] }
    """
    api_key = _get_api_key()
    genai.configure(api_key=api_key)

    if not body.transcript:
        raise HTTPException(status_code=400, detail="Transcript is empty.")

    # Build transcript text for the prompt
    transcript_text = "\n".join(
        f"{t.role.upper()}: {t.text}" for t in body.transcript
    )

    prompt = f"""You are an expert interview analyst. Below is the full transcript of a voice interview.

TRANSCRIPT:
{transcript_text}

Please analyse the transcript and return a JSON object with exactly these fields:
{{
  "summary": "<3-5 sentence overall summary of the interview>",
  "themes": ["<theme 1>", "<theme 2>", "<theme 3>"]
}}
Return ONLY valid JSON, no markdown fences, no extra text.
Include 3–7 key themes as short noun phrases."""

    try:
        model = genai.GenerativeModel("gemini-flash-latest")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )
        text = response.text.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text)
        return {
            "summary": result.get("summary", ""),
            "themes": result.get("themes", []),
        }
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse Gemini JSON: %s", exc)
        raise HTTPException(
            status_code=502, detail="Gemini returned non-JSON response."
        ) from exc
    except Exception as exc:
        logger.exception("Summarize error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
