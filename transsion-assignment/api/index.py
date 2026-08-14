"""
Unified FastAPI backend for Transsion Assignment (Module 1 + Module 2)

Endpoints:
  Module 1 (Voice Interview Assistant):
    POST /api/interview         → send conversation history, get next interviewer response
    POST /api/tts               → generate Murf AI TTS audio from text
    POST /api/summarize         → Gemini text summary + save interview to Supabase / local DB
    POST /api/admin/login       → Admin authentication endpoint
    GET  /api/admin/transcripts → Fetch all saved user interview transcripts for dashboard

  Module 2 (Sentiment Chatbot):
    POST /api/analyze           → Analyze product review aspect-level sentiment

Run locally:
  uvicorn api.index:app --reload --port 8000
"""

import os
import json
import uuid
import logging
import datetime
from pathlib import Path
from typing import List, Optional

import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(title="Transsion Assignment Unified API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ── Data directory setup ──────────────────────────────────────────────────────
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
LOCAL_FILE = DATA_DIR / "interviews.json"


# ── Helpers ───────────────────────────────────────────────────────────────────
def _get_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is not set.",
        )
    return key


def _save_interview_record(record: dict):
    # 1. Save to local JSON file
    interviews = []
    if LOCAL_FILE.exists():
        try:
            with open(LOCAL_FILE, "r", encoding="utf-8") as f:
                interviews = json.load(f)
        except Exception:
            interviews = []
    interviews.insert(0, record)
    try:
        with open(LOCAL_FILE, "w", encoding="utf-8") as f:
            json.dump(interviews, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving to local file: {e}")

    # 2. Save to Supabase REST API
    supabase_url = os.environ.get("SUPABASE_URL", "https://gqjnnetbfpekgwznrgqr.supabase.co")
    supabase_key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY")
    if supabase_url and supabase_key:
        import urllib.request
        try:
            target_url = f"{supabase_url.rstrip('/')}/rest/v1/interviews"
            payload = json.dumps(record).encode("utf-8")
            req = urllib.request.Request(
                target_url,
                data=payload,
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                    "User-Agent": "FastAPI-Backend"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                logger.info("Saved interview record to Supabase REST API.")
        except Exception as e:
            logger.warning(f"Supabase REST save note: {e}")


def _get_all_interviews() -> list:
    # 1. Try fetching from Supabase REST API first
    supabase_url = os.environ.get("SUPABASE_URL", "https://gqjnnetbfpekgwznrgqr.supabase.co")
    supabase_key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY")
    if supabase_url and supabase_key:
        import urllib.request
        try:
            target_url = f"{supabase_url.rstrip('/')}/rest/v1/interviews?select=*&order=created_at.desc"
            req = urllib.request.Request(
                target_url,
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "User-Agent": "FastAPI-Backend"
                },
                method="GET"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception as e:
            logger.warning(f"Fetch from Supabase REST fallback: {e}")

    # 2. Fallback to local JSON storage
    if LOCAL_FILE.exists():
        try:
            with open(LOCAL_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading local storage: {e}")
    return []


# ── Schemas ───────────────────────────────────────────────────────────────────
class TranscriptTurn(BaseModel):
    role: str   # "user" | "assistant"
    text: str


class InterviewRequest(BaseModel):
    conversation: List[TranscriptTurn]


class SummarizeRequest(BaseModel):
    transcript: List[TranscriptTurn]


class TTSRequest(BaseModel):
    text: str
    voice_id: str = "en-US-natalie"


class AdminLoginRequest(BaseModel):
    password: str


class AnalyzeRequest(BaseModel):
    review_text: str


# ── MODULE 1 ENDPOINTS ────────────────────────────────────────────────────────

@app.post("/api/interview")
async def interview(body: InterviewRequest):
    """Accepts conversation history [{role, text}], returns next question."""
    api_key = _get_api_key()
    genai.configure(api_key=api_key)

    system_prompt = (
        "You are an AI survey interviewer conducting a smartphone user experience survey. "
        "Your job is to ask questions ONE BY ONE in a strict sequence based on the conversation history.\n\n"
        "SURVEY QUESTION SEQUENCE:\n"
        "Step 1: Greet the participant warmly and ask for their full name. (ONLY if not answered yet)\n"
        "Step 2: Acknowledge their name, and ask which smartphone model they are currently using.\n"
        "Step 3: Acknowledge their phone model, and ask what they like MOST about their phone (e.g. camera, display, battery, design, performance).\n"
        "Step 4: Based on their answer in Step 3, ask a specific follow-up question.\n"
        "Step 5: Ask about display quality and screen experience.\n"
        "Step 6: Ask about battery life and charging speed.\n"
        "Step 7: Ask if there is any feature or issue they wish was better or different.\n"
        "Step 8: Ask for their overall satisfaction score on a scale of 1 to 10.\n"
        "Step 9: Thank them by name for participating and conclude the survey.\n\n"
        "CRITICAL RULES:\n"
        "- Look at the Conversation History below carefully.\n"
        "- NEVER repeat a question that is already in the Conversation History.\n"
        "- Respond in 1-2 sentences MAX.\n"
        "- Briefly acknowledge/react to the participant's last response, then ask the NEXT question in the sequence.\n"
        "- Do NOT use markdown, bullet points, or lists."
    )

    prompt_parts = [system_prompt, "", "=== CONVERSATION HISTORY ==="]
    for turn in body.conversation:
        speaker = "Interviewer" if turn.role == "assistant" else "Participant"
        prompt_parts.append(f"{speaker}: {turn.text}")

    if body.conversation:
        prompt_parts.append("")
        prompt_parts.append("Respond as the Interviewer for the NEXT turn. React briefly to the Participant's latest message and ask the NEXT logical question in the survey sequence:")
    else:
        prompt_parts.append("")
        prompt_parts.append("Respond as the Interviewer for Step 1: Greet the participant warmly and ask for their name.")

    prompt = "\n".join(prompt_parts)

    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]

    try:
        model = genai.GenerativeModel("gemini-3.1-flash-lite")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=200,
            ),
            safety_settings=safety_settings,
        )

        if not response.candidates:
            return {"response": "Hello! Thanks for joining this interview survey. May I please have your name to get started?"}

        candidate = response.candidates[0]
        if not candidate.content or not candidate.content.parts:
            return {"response": "Thank you! Which smartphone model are you currently using?"}

        text = candidate.content.parts[0].text.strip()
        if text.lower().startswith("interviewer"):
            text = text.split(":", 1)[-1].strip()
        return {"response": text}
    except Exception as exc:
        logger.exception("Interview error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/tts")
async def generate_tts(body: TTSRequest):
    """Generates TTS audio via Murf AI API."""
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty.")

    murf_key = os.environ.get("MURF_API_KEY")
    if not murf_key:
        raise HTTPException(status_code=500, detail="MURF_API_KEY environment variable is not set.")

    import urllib.request
    import urllib.error

    url = "https://api.murf.ai/v1/speech/generate"
    payload = json.dumps({
        "voiceId": body.voice_id,
        "text": body.text.strip(),
        "format": "MP3"
    }).encode()

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "api-key": murf_key,
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            audio_url = data.get("audioFile")
            if not audio_url:
                raise HTTPException(status_code=502, detail=f"Murf AI error: {data}")
            return {"audio_url": audio_url}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        logger.error("Murf AI error %s: %s", exc.code, detail)
        raise HTTPException(status_code=exc.code, detail=detail) from exc
    except Exception as exc:
        logger.exception("Murf TTS error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/summarize")
async def summarize(body: SummarizeRequest):
    """Generates summary + saves transcript to DB under user_name."""
    api_key = _get_api_key()
    genai.configure(api_key=api_key)

    if not body.transcript:
        raise HTTPException(status_code=400, detail="Transcript is empty.")

    transcript_text = "\n".join(
        f"{t.role.upper()}: {t.text}" for t in body.transcript
    )

    prompt = f"""You are an expert interview analyst. Below is the full transcript of a voice interview.

TRANSCRIPT:
{transcript_text}

Please analyse the transcript and return a JSON object with exactly these fields:
{{
  "user_name": "<the full name of the participant from the interview, e.g. Ayush Chaudhary. If not stated, put 'Participant'>",
  "summary": "<3-5 sentence overall summary of the interview>",
  "themes": ["<theme 1>", "<theme 2>", "<theme 3>"]
}}
Return ONLY valid JSON, no markdown fences, no extra text."""

    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]

    try:
        model = genai.GenerativeModel("gemini-3.1-flash-lite")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
            safety_settings=safety_settings,
        )

        user_name = "Participant"
        summary_text = "Interview completed."
        themes_list = ["Smartphone Survey"]

        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            text = response.candidates[0].content.parts[0].text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            try:
                result = json.loads(text)
                user_name = result.get("user_name") or "Participant"
                summary_text = result.get("summary") or "Interview completed."
                themes_list = result.get("themes") or ["Smartphone Survey"]
            except Exception:
                pass

        record = {
            "id": str(uuid.uuid4()),
            "user_name": user_name,
            "transcript": [t.dict() for t in body.transcript],
            "summary": summary_text,
            "themes": themes_list,
            "created_at": datetime.datetime.utcnow().isoformat() + "Z"
        }
        _save_interview_record(record)

        return {
            "user_name": user_name,
            "summary": summary_text,
            "themes": themes_list,
            "saved": True
        }
    except Exception as exc:
        logger.exception("Summarize error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/admin/login")
async def admin_login(body: AdminLoginRequest):
    expected_pass = os.environ.get("ADMIN_PASSWORD", "admin123")
    if body.password != expected_pass:
        raise HTTPException(status_code=401, detail="Invalid admin password.")
    return {"authenticated": True, "token": "admin-authorized"}


@app.get("/api/admin/transcripts")
async def get_admin_transcripts():
    interviews = _get_all_interviews()
    return {"interviews": interviews}


# ── MODULE 2 ENDPOINTS ────────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze_sentiment(body: AnalyzeRequest):
    """Aspect-level sentiment analysis endpoint for product reviews."""
    api_key = _get_api_key()
    genai.configure(api_key=api_key)

    if not body.review_text.strip():
        raise HTTPException(status_code=400, detail="review_text is required.")

    response_schema = {
        "type": "OBJECT",
        "properties": {
            "overall_sentiment": {
                "type": "STRING",
                "enum": ["positive", "negative", "neutral", "mixed"],
            },
            "aspects": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "aspect": {"type": "STRING"},
                        "sentiment": {
                            "type": "STRING",
                            "enum": ["positive", "negative", "neutral"],
                        },
                        "reasoning": {"type": "STRING"},
                    },
                    "required": ["aspect", "sentiment", "reasoning"],
                },
            },
        },
        "required": ["overall_sentiment", "aspects"],
    }

    prompt = f"""You are a product review analyst specialising in consumer electronics.

Analyse the following product review and identify distinct product features or aspects mentioned (e.g. battery life, camera, display, price, build quality, performance, etc.).

For each aspect, determine whether the reviewer's sentiment is positive, negative, or neutral, and give a short one-sentence reasoning.

Also provide an overall_sentiment (positive / negative / neutral / mixed) for the entire review.

REVIEW:
{body.review_text}"""

    try:
        model = genai.GenerativeModel("gemini-3.1-flash-lite")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.2,
            ),
        )
        text = response.text.strip()
        result = json.loads(text)
        return result
    except Exception as exc:
        logger.exception("Analyze error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
