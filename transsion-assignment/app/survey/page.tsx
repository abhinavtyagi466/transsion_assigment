"use client";

/**
 * Module 1 — Voice Interview Assistant & Admin Dashboard
 */

import { useRef, useState, useCallback } from "react";
import Link from "next/link";

/* ── Types ─────────────────────────────────────────────── */
type Turn = { role: "user" | "assistant"; text: string };
type SessionState = "idle" | "listening" | "thinking" | "speaking" | "closed" | "error";

interface SummaryResult {
  user_name: string;
  summary: string;
  themes: string[];
}

interface SavedInterview {
  id: string;
  user_name: string;
  transcript: Turn[];
  summary: string;
  themes: string[];
  created_at: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export default function VoiceInterviewPage() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [interimText, setInterimText] = useState("");
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin Dashboard State
  const [isAdminView, setIsAdminView] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [savedInterviews, setSavedInterviews] = useState<SavedInterview[]>([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(false);
  const [expandedInterviewId, setExpandedInterviewId] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef<Turn[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const isActiveRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);

  const addTurn = useCallback((turn: Turn): Turn[] => {
    const next = [...transcriptRef.current, turn];
    transcriptRef.current = next;
    setTranscript(next);
    setTimeout(() => {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
    return next;
  }, []);

  const speakWithMurf = useCallback(async (text: string): Promise<void> => {
    try {
      setSessionState("speaking");
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice_id: "en-US-natalie" }),
      });
      if (res.ok) {
        const { audio_url } = await res.json();
        if (audio_url) {
          return new Promise<void>((resolve) => {
            const audio = new Audio(audio_url);
            audioRef.current = audio;
            audio.onended = () => {
              audioRef.current = null;
              resolve();
            };
            audio.onerror = () => {
              audioRef.current = null;
              resolve();
            };
            audio.play().catch(() => resolve());
          });
        }
      }
    } catch (err) {
      console.error("Murf TTS error:", err);
    }
  }, []);

  const getInterviewerResponse = useCallback(async (conversation: Turn[]): Promise<string | null> => {
    try {
      setSessionState("thinking");
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation }),
      });
      if (res.ok) {
        const { response } = await res.json();
        return response;
      }
      return null;
    } catch (err) {
      console.error("Interview API error:", err);
      return null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isActiveRef.current) return;

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Your browser does not support Speech Recognition. Please use Chrome.");
      setSessionState("error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setSessionState("listening");
      setInterimText("");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) setInterimText(interim);

      if (finalText.trim() && !isProcessingRef.current) {
        isProcessingRef.current = true;
        setInterimText("");
        try {
          recognition.stop();
        } catch (_) {}

        const userTurn: Turn = { role: "user", text: finalText.trim() };
        const updatedConversation = addTurn(userTurn);

        getInterviewerResponse(updatedConversation).then(async (response) => {
          if (response && isActiveRef.current) {
            const assistantTurn: Turn = { role: "assistant", text: response };
            addTurn(assistantTurn);
            await speakWithMurf(response);
          }
          isProcessingRef.current = false;
          if (isActiveRef.current) {
            startListening();
          }
        }).catch(() => {
          isProcessingRef.current = false;
        });
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error === "no-speech" && isActiveRef.current && !isProcessingRef.current) {
        setTimeout(() => {
          if (isActiveRef.current && !isProcessingRef.current) startListening();
        }, 300);
        return;
      }
      if (event.error === "aborted") return;
      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {};

    recognition.start();
  }, [addTurn, getInterviewerResponse, speakWithMurf]);

  const startInterview = useCallback(async () => {
    setError(null);
    setSummary(null);
    setTranscript([]);
    transcriptRef.current = [];
    isProcessingRef.current = false;
    isActiveRef.current = true;
    setSessionState("thinking");

    const greeting = await getInterviewerResponse([]);
    if (greeting) {
      const greetingTurn: Turn = { role: "assistant", text: greeting };
      addTurn(greetingTurn);
      await speakWithMurf(greeting);
      if (isActiveRef.current) {
        startListening();
      }
    } else {
      setError("Could not connect to interview service.");
      setSessionState("error");
      isActiveRef.current = false;
    }
  }, [addTurn, getInterviewerResponse, speakWithMurf, startListening]);

  const stopInterview = useCallback(async () => {
    isActiveRef.current = false;
    isProcessingRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setSessionState("closed");

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

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) {
        setAdminAuth(true);
        fetchSavedTranscripts();
      } else {
        setAdminError("Invalid admin password. (Default: admin123)");
      }
    } catch {
      setAdminError("Could not authenticate admin.");
    }
  };

  const fetchSavedTranscripts = async () => {
    setLoadingTranscripts(true);
    try {
      const res = await fetch("/api/admin/transcripts");
      if (res.ok) {
        const data = await res.json();
        setSavedInterviews(data.interviews || []);
      }
    } catch (err) {
      console.error("Error fetching admin transcripts:", err);
    } finally {
      setLoadingTranscripts(false);
    }
  };

  const isActive = sessionState === "listening" || sessionState === "thinking" || sessionState === "speaking";
  const stateLabels: Record<SessionState, string> = {
    idle: "Idle — ready to start",
    listening: "🎙 Listening to you…",
    thinking: "🤔 Interviewer is thinking…",
    speaking: "🔊 Interviewer is speaking…",
    closed: "Session ended",
    error: "Error occurred",
  };

  return (
    <main className="page">
      <div className="nav-back">
        <Link href="/" className="back-btn">← Back to Platform Hub</Link>
      </div>

      <header className="header">
        <h1>🎙 Voice Survey Agent</h1>
        <p>Interactive voice interview assistant powered by Gemini 3.1 &amp; Murf TTS</p>
        <button
          className="admin-toggle-btn"
          onClick={() => {
            setIsAdminView(!isAdminView);
            if (!isAdminView && adminAuth) fetchSavedTranscripts();
          }}
        >
          {isAdminView ? "← Back to Interview" : "🔐 Admin Dashboard & Transcripts"}
        </button>
      </header>

      {/* ADMIN VIEW */}
      {isAdminView ? (
        <section className="admin-container">
          {!adminAuth ? (
            <div className="admin-login-box">
              <h2>🔒 Admin Authentication</h2>
              <p>Enter password to view user transcripts saved in Supabase.</p>
              <form onSubmit={handleAdminLogin}>
                <input
                  type="password"
                  placeholder="Enter admin password (admin123)"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="admin-input"
                  required
                />
                <button type="submit" className="btn btn-start" style={{ width: "100%", justifyContent: "center" }}>
                  Unlock Admin Dashboard
                </button>
              </form>
              {adminError && <p className="error-msg" style={{ marginTop: 12 }}>⚠ {adminError}</p>}
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2>📁 Saved User Transcripts ({savedInterviews.length})</h2>
                <button className="btn" onClick={fetchSavedTranscripts} style={{ padding: "6px 14px", fontSize: "0.85rem", background: "var(--surface-alt)" }}>
                  🔄 Refresh
                </button>
              </div>

              {loadingTranscripts ? (
                <p className="status-label">
                  <span className="spinner" style={{ marginRight: 8 }} /> Loading saved transcripts…
                </p>
              ) : savedInterviews.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No saved transcripts yet. Complete an interview to see it here!</p>
              ) : (
                <div className="transcripts-list">
                  {savedInterviews.map((item) => {
                    const isExpanded = expandedInterviewId === item.id;
                    const formattedDate = new Date(item.created_at || Date.now()).toLocaleString();

                    return (
                      <div key={item.id} className="transcript-card">
                        <div
                          className="transcript-card-header"
                          onClick={() => setExpandedInterviewId(isExpanded ? null : item.id)}
                        >
                          <div>
                            <h3 style={{ fontSize: "1.05rem" }}>
                              Transcript for {item.user_name || "Participant"}
                            </h3>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formattedDate}</span>
                          </div>
                          <span style={{ fontSize: "1.2rem", color: "var(--text-secondary)" }}>
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className="transcript-card-body">
                            <div style={{ marginBottom: 16 }}>
                              <h4 style={{ marginBottom: 6 }}>Summary</h4>
                              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 12 }}>{item.summary}</p>

                              {item.themes && item.themes.length > 0 && (
                                <div className="themes-list" style={{ marginBottom: 16 }}>
                                  {item.themes.map((t, idx) => (
                                    <span key={idx} className="theme-tag">{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <h4 style={{ marginBottom: 8 }}>Full Dialogue Transcript</h4>
                            <div className="transcript-dialogue">
                              {item.transcript && item.transcript.map((t, idx) => (
                                <div key={idx} className={`turn ${t.role}`} style={{ marginBottom: 8 }}>
                                  <span className={`turn-role ${t.role}`}>
                                    {t.role === "user" ? item.user_name || "User" : "Interviewer"}
                                  </span>
                                  <p className="turn-text" style={{ fontSize: "0.88rem" }}>{t.text}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        /* INTERVIEW VIEW */
        <>
          <div className="status-bar" role="status" aria-live="polite">
            <span className={`status-dot ${sessionState}`} aria-hidden="true" />
            <span className="status-label">Status:</span>
            <span className="status-value">{stateLabels[sessionState]}</span>
          </div>

          <div className="controls">
            <button
              id="btn-start-interview"
              className="btn btn-start"
              onClick={startInterview}
              disabled={isActive}
            >
              {sessionState === "thinking" && transcript.length === 0 ? (
                <>
                  <span className="spinner" />
                  Starting…
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
            >
              ⏹ Stop &amp; Summarize
            </button>
          </div>

          {error && <p className="error-msg" role="alert">⚠ {error}</p>}

          <section className="transcript-panel">
            {transcript.map((turn, i) => (
              <div key={i} className={`turn ${turn.role}`}>
                <span className={`turn-role ${turn.role}`}>
                  {turn.role === "user" ? "You" : "Interviewer"}
                </span>
                <p className="turn-text">{turn.text}</p>
              </div>
            ))}
            {interimText && (
              <div className="turn user interim">
                <span className="turn-role user">You</span>
                <p className="turn-text">{interimText}…</p>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </section>

          {summaryLoading && (
            <div className="summary-panel">
              <p className="status-label">
                <span className="spinner" style={{ marginRight: 8 }} />
                Generating summary &amp; saving transcript to Supabase…
              </p>
            </div>
          )}

          {summary && !summaryLoading && (
            <section className="summary-panel">
              <h2>📋 Interview Summary ({summary.user_name || "Participant"})</h2>
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
              <p style={{ marginTop: 16, fontSize: "0.82rem", color: "#3fb950" }}>
                ✓ Transcript saved to database for {summary.user_name || "Participant"}.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
