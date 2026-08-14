"use client";

/**
 * Module 2 — Sentiment Chatbot Page
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

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
  text?: string;
  result?: AnalyzeResponse;
}

function sentimentEmoji(s: string): string {
  if (s === "positive") return "😊";
  if (s === "negative") return "😞";
  return "😐";
}

export default function SentimentChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleAnalyze() {
    const text = reviewText.trim();
    if (!text) return;

    setError(null);
    setLoading(true);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleAnalyze();
    }
  }

  return (
    <main className="page">
      <div className="nav-back">
        <Link href="/" className="back-btn">← Back to Platform Hub</Link>
      </div>

      <header className="header">
        <h1>📊 Sentiment Analysis Bot</h1>
        <p>
          Paste a product review — get feature-level sentiment analysis powered by Gemini 3.1
        </p>
      </header>

      <div className="chat-window" aria-live="polite" aria-label="Chat history">
        {messages.length === 0 && !loading && (
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
            No reviews analyzed yet. Paste a product review below and click Analyze Sentiment.
          </p>
        )}

        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="message user">
              <span className="message-role">You</span>
              <div className="bubble">{msg.text}</div>
            </div>
          ) : (
            <div key={msg.id} className="message bot">
              <span className="message-role">Sentiment Breakdown</span>
              <div className="bubble">
                {msg.result && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <strong>Overall Sentiment:</strong>{" "}
                      {sentimentEmoji(msg.result.overall_sentiment)}{" "}
                      <span style={{ textTransform: "capitalize" }}>{msg.result.overall_sentiment}</span>
                    </div>
                    <div className="aspects-list">
                      {msg.result.aspects.map((a, i) => (
                        <div key={i} className="aspect-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span className="aspect-name">{a.aspect}</span>
                            <span className={`sentiment-badge ${a.sentiment}`}>
                              {sentimentEmoji(a.sentiment)} {a.sentiment}
                            </span>
                          </div>
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

        {loading && (
          <div className="message bot">
            <span className="message-role">Sentiment Analysis</span>
            <div className="bubble" style={{ color: "var(--text-muted)" }}>
              <span className="spinner" style={{ marginRight: 8 }} />
              Analysing review with Gemini…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className="error-msg" role="alert">⚠ {error}</p>}

      <div className="input-area">
        <textarea
          className="review-textarea"
          placeholder="Paste or type a product review here… (Ctrl+Enter to submit)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={5}
        />
        <div className="input-row">
          <span className="char-count">{reviewText.length} characters</span>
          <button
            id="btn-analyze-sentiment"
            className="btn-analyze"
            onClick={handleAnalyze}
            disabled={loading || reviewText.trim().length === 0}
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
