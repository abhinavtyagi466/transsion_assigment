"use client";

/**
 * Module 1 — Voice Interview Assistant
 *
 * Flow:
 *  1. User clicks "Start Interview"
 *  2. Browser requests mic permission
 *  3. Frontend calls GET /api/token → receives ephemeral token
 *  4. Frontend opens WebSocket to Gemini Live using that token
 *  5. Audio is streamed; incoming transcripts shown in real-time
 *  6. User clicks "Stop Interview"
 *  7. Frontend POSTs full transcript to POST /api/summarize
 *  8. Summary + themes rendered below transcript
 */

import { useRef, useState, useCallback } from "react";

/* ── Types ─────────────────────────────────────────────── */
type Turn = { role: "user" | "assistant"; text: string };
type ConnectionState = "idle" | "connecting" | "open" | "closed" | "error";

interface SummaryResult {
  summary: string;
  themes: string[];
}

/* ── Gemini Live constants ─────────────────────────────── */
// Gemini Live WebSocket endpoint (token-authenticated)
const GEMINI_LIVE_WS_BASE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";

const SAMPLE_RATE = 16000; // Hz required by Gemini Live

/* ── Helper — encode PCM Float32 → Int16 Base64 ─────────── */
function float32ToInt16Base64(buffer: Float32Array): string {
  const int16 = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/* ── Helper — decode Base64 audio from Gemini → PCM ──────── */
function base64ToFloat32(b64: string): Float32Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer as ArrayBuffer);
  const buf = new ArrayBuffer(int16.length * 4);
  const float32 = new Float32Array(buf);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
  return float32;
}

/* ── Component ─────────────────────────────────────────── */
export default function VoiceInterviewPage() {
  const [connState, setConnState] = useState<ConnectionState>("idle");
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs so callbacks always have current values
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptRef = useRef<Turn[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Keep transcriptRef in sync
  const addTurn = useCallback((turn: Turn) => {
    setTranscript((prev) => {
      const next = [...prev, turn];
      transcriptRef.current = next;
      return next;
    });
    setTimeout(() => {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  /* ── 1. Start Interview ─────────────────────────────────── */
  const startInterview = useCallback(async () => {
    setError(null);
    setSummary(null);
    setTranscript([]);
    transcriptRef.current = [];
    setConnState("connecting");

    try {
      // a) Fetch ephemeral token from our API (never exposes raw key to browser)
      const tokenRes = await fetch("/api/token");
      if (!tokenRes.ok) throw new Error("Failed to get token from /api/token");
      const { token } = await tokenRes.json();

      // b) Request mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // c) Open Gemini Live WebSocket
      const wsUrl = `${GEMINI_LIVE_WS_BASE}?key=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnState("open");

        // Send setup message
        ws.send(
          JSON.stringify({
            setup: {
              model: "models/gemini-2.0-flash-live-001",
              generation_config: {
                response_modalities: ["AUDIO", "TEXT"],
                speech_config: {
                  voice_config: {
                    prebuilt_voice_config: { voice_name: "Aoede" },
                  },
                },
              },
              system_instruction: {
                parts: [
                  {
                    text: "You are a professional interviewer conducting a voice interview. Ask clear, relevant questions. Listen carefully to answers and respond naturally.",
                  },
                ],
              },
            },
          })
        );

        // d) Wire up microphone audio → WebSocket
        const AudioContext =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        // ScriptProcessorNode is deprecated but widely supported; fine for demo
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const pcm = e.inputBuffer.getChannelData(0);
          const b64 = float32ToInt16Base64(pcm);
          ws.send(
            JSON.stringify({
              realtime_input: {
                media_chunks: [
                  { mime_type: "audio/pcm;rate=16000", data: b64 },
                ],
              },
            })
          );
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      // e) Handle incoming messages
      ws.onmessage = async (event) => {
        try {
          const data =
            event.data instanceof Blob
              ? JSON.parse(await event.data.text())
              : JSON.parse(event.data);

          // Text transcript
          const parts =
            data?.serverContent?.modelTurn?.parts ??
            data?.serverContent?.outputTranscription?.parts ??
            [];
          for (const part of parts) {
            if (part.text?.trim()) {
              addTurn({ role: "assistant", text: part.text.trim() });
            }
          }

          // Input transcription (user speech → text)
          const userParts =
            data?.serverContent?.inputTranscription?.parts ?? [];
          for (const part of userParts) {
            if (part.text?.trim()) {
              addTurn({ role: "user", text: part.text.trim() });
            }
          }

          // Audio response — play it back
          const audioParts =
            data?.serverContent?.modelTurn?.parts ?? [];
          for (const part of audioParts) {
            if (part.inlineData?.mimeType?.startsWith("audio/")) {
              const float32 = base64ToFloat32(part.inlineData.data);
              if (audioCtxRef.current) {
                const buffer = audioCtxRef.current.createBuffer(
                  1,
                  float32.length,
                  SAMPLE_RATE
                );
                buffer.copyToChannel(float32, 0);
                const src = audioCtxRef.current.createBufferSource();
                src.buffer = buffer;
                src.connect(audioCtxRef.current.destination);
                src.start();
              }
            }
          }
        } catch {
          // Non-JSON or unparseable frame — ignore
        }
      };

      ws.onerror = () => {
        setConnState("error");
        setError("WebSocket error — check console for details.");
      };

      ws.onclose = () => {
        setConnState((prev) => (prev === "open" ? "closed" : prev));
      };
    } catch (err: unknown) {
      setConnState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [addTurn]);

  /* ── 2. Stop Interview ──────────────────────────────────── */
  const stopInterview = useCallback(async () => {
    // Close mic + WebSocket
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;

    setConnState("closed");

    // POST transcript to /api/summarize
    const turns = transcriptRef.current;
    if (turns.length === 0) return;

    setSummaryLoading(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: turns }),
      });
      if (!res.ok) throw new Error(`/api/summarize returned ${res.status}`);
      const result: SummaryResult = await res.json();
      setSummary(result);
    } catch (err: unknown) {
      setError(
        "Could not generate summary: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  /* ── Derived state ──────────────────────────────────────── */
  const isActive = connState === "open" || connState === "connecting";
  const stateLabels: Record<ConnectionState, string> = {
    idle: "Idle — ready to start",
    connecting: "Connecting to Gemini Live…",
    open: "Connected — interview in progress",
    closed: "Session ended",
    error: "Connection error",
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <main className="page">
      <header className="header">
        <h1>🎙 Voice Interview Assistant</h1>
        <p>Powered by Gemini Live · speak naturally and get a full summary</p>
      </header>

      {/* Status bar */}
      <div className="status-bar" role="status" aria-live="polite">
        <span className={`status-dot ${connState}`} aria-hidden="true" />
        <span className="status-label">Connection:</span>
        <span className="status-value">{stateLabels[connState]}</span>
      </div>

      {/* Controls */}
      <div className="controls">
        <button
          id="btn-start-interview"
          className="btn btn-start"
          onClick={startInterview}
          disabled={isActive}
          aria-label="Start interview session"
        >
          {connState === "connecting" ? (
            <>
              <span className="spinner" />
              Connecting…
            </>
          ) : (
            "▶ Start Interview"
          )}
        </button>

        <button
          id="btn-stop-interview"
          className="btn btn-stop"
          onClick={stopInterview}
          disabled={!isActive}
          aria-label="Stop interview session and generate summary"
        >
          ⏹ Stop &amp; Summarize
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p className="error-msg" role="alert">
          ⚠ {error}
        </p>
      )}

      {/* Live transcript */}
      <section
        className="transcript-panel"
        aria-label="Live interview transcript"
      >
        {transcript.map((turn, i) => (
          <div key={i} className={`turn ${turn.role}`}>
            <span className={`turn-role ${turn.role}`}>
              {turn.role === "user" ? "You" : "Interviewer"}
            </span>
            <p className="turn-text">{turn.text}</p>
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </section>

      {/* Post-interview summary */}
      {summaryLoading && (
        <div className="summary-panel">
          <p className="status-label">
            <span className="spinner" style={{ marginRight: 8 }} />
            Generating summary…
          </p>
        </div>
      )}

      {summary && !summaryLoading && (
        <section className="summary-panel" aria-label="Interview summary">
          <h2>📋 Interview Summary</h2>
          <p className="summary-text">{summary.summary}</p>
          {summary.themes.length > 0 && (
            <>
              <h2 style={{ marginBottom: 10 }}>🏷 Key Themes</h2>
              <div className="themes-list">
                {summary.themes.map((theme, i) => (
                  <span key={i} className="theme-tag">
                    {theme}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
