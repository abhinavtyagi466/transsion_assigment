"""
Module 2 — Sentiment Chatbot — FastAPI backend

Endpoint:
  POST /api/analyze  → feature-level sentiment analysis via Gemini

Run locally:
  uvicorn api.index:app --reload --port 8001
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
app = FastAPI(title="Sentiment Chatbot API", version="1.0.0")

# Allow Next.js dev server (port 3001) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://127.0.0.1:3001"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

# ── Helpers ───────────────────────────────────────────────────────────────────
def _get_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set.",
        )
    return key


# ── Schemas ───────────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    review_text: str


class AspectSentiment(BaseModel):
    aspect: str
    sentiment: str  # "positive" | "negative" | "neutral"
    reasoning: str


class AnalyzeResponse(BaseModel):
    aspects: List[AspectSentiment]
    overall_sentiment: str


# ── POST /api/analyze ─────────────────────────────────────────────────────────
@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeRequest):
    """
    Accepts { review_text: str }.
    Calls Gemini gemini-2.5-flash with a structured JSON schema and returns:
      { aspects: [{aspect, sentiment, reasoning}], overall_sentiment }
    Fully stateless — no DB, no session tracking.
    """
    if not body.review_text.strip():
        raise HTTPException(status_code=400, detail="review_text is empty.")

    api_key = _get_api_key()
    genai.configure(api_key=api_key)

    # Response schema enforced via response_mime_type + response_schema
    response_schema = {
        "type": "object",
        "properties": {
            "aspects": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "aspect":    {"type": "string"},
                        "sentiment": {
                            "type": "string",
                            "enum": ["positive", "negative", "neutral"],
                        },
                        "reasoning": {"type": "string"},
                    },
                    "required": ["aspect", "sentiment", "reasoning"],
                },
            },
            "overall_sentiment": {"type": "string"},
        },
        "required": ["aspects", "overall_sentiment"],
    }

    prompt = f"""You are a product review analyst specialising in consumer electronics.

Analyse the following product review and identify distinct product features or aspects mentioned (e.g. battery life, camera, display, price, build quality, performance, etc.).

For each aspect, determine whether the reviewer's sentiment is positive, negative, or neutral, and give a short one-sentence reasoning.

Also provide an overall_sentiment (positive / negative / neutral / mixed) for the entire review.

REVIEW:
{body.review_text}"""

    try:
        model = genai.GenerativeModel("gemini-flash-latest")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.2,
            ),
        )
        text = response.text.strip()
        # Strip markdown fences if model returns them anyway
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text)
        return AnalyzeResponse(**result)
    except json.JSONDecodeError as exc:
        logger.error("Non-JSON Gemini response: %s", exc)
        raise HTTPException(
            status_code=502, detail="Gemini returned a non-JSON response."
        ) from exc
    except Exception as exc:
        logger.exception("Analyze error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
