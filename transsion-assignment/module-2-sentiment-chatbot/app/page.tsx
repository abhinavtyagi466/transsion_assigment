"use client";

/**
 * Module 2 — Sentiment Chatbot
 *
 * Flow:
 *  1. User types/pastes a product review in the textarea
 *  2. Clicks "Analyze Sentiment"
 *  3. Frontend POSTs { review_text } to /api/analyze
 *  4. Response: { aspects: [{aspect, sentiment, reasoning}], overall_sentiment }
 *  5. Both the user's review and the bot's aspect breakdown appear as chat bubbles
 *  6. History is kept in local state (no DB, fully stateless per request)
 */

import { useState, useRef, useEffect } from "react";

/* ── Types ─────────────────────────────────────────────── */
interface Aspect {
  aspect: string;
  sentiment: "positive" | "negative" | "neutral";
  reasoning: string;
}

interface AnalyzeResponse {
  aspects: Aspect[];
  overall_sentiment: string;
}

type MessageRole = "user" | "bot";

interface ChatMessage {
  id: number;
  role: MessageRole;
  /** user messages: the raw review text; bot messages: null */
  text?: string;
  /** bot messages only */
  result?: AnalyzeResponse;
}

/* ── Sentiment emoji helper ──────────────────────────────── */
function sentimentEmoji(s: string): string {
  if (s === "positive") return "😊";
  if (s === "negative") return "😞";
  return "😐";
}

/* ── Component ─────────────────────────────────────────── */
export default function SentimentChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Analyze handler ─────────────────────────────────── */
  async function handleAnalyze() {
    const text = reviewText.trim();
    if (!text) return;

    setError(null);
    setLoading(true);

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: nextId.current++,
      role: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setReviewText("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_text: text }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`/api/analyze returned ${res.status}: ${errBody}`);
      }

      const data: AnalyzeResponse = await res.json();

      const botMsg: ChatMessage = {
        id: nextId.current++,
        role: "bot",
        result: data,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  /* ── Keyboard shortcut: Cmd/Ctrl+Enter to submit ─────── */
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleAnalyze();
    }
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <main className="page">
      <header className="header">
        <h1>🔍 Sentiment Chatbot</h1>
        <p>
          Paste a product review — get feature-level sentiment analysis powered
          by Gemini
        </p>
      </header>

      {/* Chat history */}
      <div className="chat-window" aria-live="polite" aria-label="Chat history">
        {messages.length === 0 && !loading && (
          <p className="empty-state">
            No messages yet. Paste a review below and click Analyze Sentiment.
          </p>
        )}

        {messages.map((msg) =>
          msg.role === "user" ? (
            /* User bubble */
            <div key={msg.id} className="message user">
              <span className="message-role">You</span>
              <div className="bubble">{msg.text}</div>
            </div>
          ) : (
            /* Bot bubble */
            <div key={msg.id} className="message bot">
              <span className="message-role">Sentiment Analysis</span>
              <div className="bubble">
                {msg.result && (
                  <>
                    <div className="overall-sentiment">
                      <strong>Overall:</strong>{" "}
                      {sentimentEmoji(msg.result.overall_sentiment)}{" "}
                      {msg.result.overall_sentiment}
                    </div>
                    <div className="aspects-list">
                      {msg.result.aspects.map((a, i) => (
                        <div key={i} className="aspect-card">
                          <span className="aspect-name">{a.aspect}</span>
                          <span
                            className={`sentiment-badge ${a.sentiment}`}
                          >
                            {sentimentEmoji(a.sentiment)} {a.sentiment}
                          </span>
                          <p className="aspect-reasoning">{a.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="message bot">
            <span className="message-role">Sentiment Analysis</span>
            <div className="bubble" style={{ color: "var(--text-muted)" }}>
              <span className="spinner" style={{ marginRight: 8 }} />
              Analysing review…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <p className="error-msg" role="alert">
          ⚠ {error}
        </p>
      )}

      {/* Input area */}
      <div className="input-area">
        <label htmlFor="review-input" className="sr-only">
          Product review
        </label>
        <textarea
          id="review-input"
          className="review-textarea"
          placeholder="Paste or type a product review here… (Ctrl+Enter to submit)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={5}
        />
        <div className="input-row">
          <span className="char-count">{reviewText.length} chars</span>
          <button
            id="btn-analyze-sentiment"
            className="btn-analyze"
            onClick={handleAnalyze}
            disabled={loading || reviewText.trim().length === 0}
            aria-label="Analyze sentiment of the review"
          >
            {loading ? (
              <>
                <span className="spinner" />
                Analysing…
              </>
            ) : (
              "🔍 Analyze Sentiment"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
