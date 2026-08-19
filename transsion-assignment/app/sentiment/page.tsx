"use client";

/**
 * Module 2 — Sentiment Chatbot Page & Web Scraper Dashboard
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

interface ScrapedReviewItem {
  user: string;
  rating: string;
  source: string;
  text: string;
  analysis: AnalyzeResponse;
}

interface ScrapeResult {
  url: string;
  platform: string;
  product_name: string;
  total_scraped: number;
  overall_sentiment: string;
  sentiment_counts: { positive: number; negative: number; neutral: number; mixed: number };
  aspect_matrix: Record<string, { positive: number; negative: number; neutral: number; total: number }>;
  reviews: ScrapedReviewItem[];
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
  const [activeTab, setActiveTab] = useState<"text" | "scraper">("text");

  // Single review state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [loadingText, setLoadingText] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Web Scraper state
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [loadingScrape, setLoadingScrape] = useState(false);
  const [errorScrape, setErrorScrape] = useState<string | null>(null);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);

  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── 1. Single Text Analysis Handler ────────────────── */
  async function handleAnalyzeText() {
    const text = reviewText.trim();
    if (!text) return;

    setErrorText(null);
    setLoadingText(true);

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
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingText(false);
    }
  }

  /* ── 2. Web Scraper Handler ─────────────────────────── */
  async function handleScrape(urlToScrape?: string) {
    const targetUrl = (urlToScrape || scrapeUrl).trim();
    if (!targetUrl) return;

    setErrorScrape(null);
    setLoadingScrape(true);
    setScrapeResult(null);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, max_reviews: 5 }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`/api/scrape returned ${res.status}: ${errBody}`);
      }

      const data: ScrapeResult = await res.json();
      setScrapeResult(data);
    } catch (err: unknown) {
      setErrorScrape(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingScrape(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleAnalyzeText();
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
          Analyze product review text OR scrape live e-commerce reviews from Flipkart / Amazon
        </p>

        {/* Tab Switcher */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
          <button
            onClick={() => setActiveTab("text")}
            className="btn"
            style={{
              background: activeTab === "text" ? "#ffffff" : "var(--surface-alt)",
              color: activeTab === "text" ? "#000000" : "var(--text-secondary)",
              padding: "8px 18px",
              fontSize: "0.88rem"
            }}
          >
            💬 Single Review Text
          </button>
          <button
            onClick={() => setActiveTab("scraper")}
            className="btn"
            style={{
              background: activeTab === "scraper" ? "#ffffff" : "var(--surface-alt)",
              color: activeTab === "scraper" ? "#000000" : "var(--text-secondary)",
              padding: "8px 18px",
              fontSize: "0.88rem"
            }}
          >
            🕸️ Web Review Scraper
          </button>
        </div>
      </header>

      {/* ── TAB 1: SINGLE REVIEW TEXT ────────────────────────── */}
      {activeTab === "text" && (
        <>
          <div className="chat-window" aria-live="polite" aria-label="Chat history">
            {messages.length === 0 && !loadingText && (
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

            {loadingText && (
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

          {errorText && <p className="error-msg" role="alert">⚠ {errorText}</p>}

          <div className="input-area">
            <textarea
              className="review-textarea"
              placeholder="Paste or type a product review here… (Ctrl+Enter to submit)"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loadingText}
              rows={5}
            />
            <div className="input-row">
              <span className="char-count">{reviewText.length} characters</span>
              <button
                id="btn-analyze-sentiment"
                className="btn-analyze"
                onClick={handleAnalyzeText}
                disabled={loadingText || reviewText.trim().length === 0}
              >
                {loadingText ? (
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
        </>
      )}

      {/* ── TAB 2: WEB REVIEW SCRAPER ───────────────────────── */}
      {activeTab === "scraper" && (
        <section style={{ width: "100%", maxWidth: 720 }}>
          <div className="admin-container" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: 8 }}>🕷️ E-Commerce Web Review Scraper</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: 16 }}>
              Scrape live customer reviews from Flipkart or Amazon URL and run Gemini aspect sentiment analysis.
            </p>

            {/* Quick Sample Links */}
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Try Sample E-Commerce Product URLs:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: "4px 10px", fontSize: "0.78rem", background: "var(--surface-alt)" }}
                  onClick={() => {
                    const u = "https://www.flipkart.com/tecno-camon-20-purity-white-256-gb/product-reviews/itm4b2931a742880";
                    setScrapeUrl(u);
                    handleScrape(u);
                  }}
                >
                  📱 Tecno Camon 20 (Flipkart)
                </button>

                <button
                  type="button"
                  className="btn"
                  style={{ padding: "4px 10px", fontSize: "0.78rem", background: "var(--surface-alt)" }}
                  onClick={() => {
                    const u = "https://www.amazon.in/Infinix-Note-30-5G-Sunset/dp/B0C895K32L";
                    setScrapeUrl(u);
                    handleScrape(u);
                  }}
                >
                  📱 Infinix Note 30 5G (Amazon)
                </button>

                <button
                  type="button"
                  className="btn"
                  style={{ padding: "4px 10px", fontSize: "0.78rem", background: "var(--surface-alt)" }}
                  onClick={() => {
                    const u = "https://www.flipkart.com/itel-p55-5G-mint-green-64-gb/product-reviews/itm0a2731c732991";
                    setScrapeUrl(u);
                    handleScrape(u);
                  }}
                >
                  📱 itel P55 5G (Flipkart)
                </button>
              </div>
            </div>

            {/* URL Input Form */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                className="admin-input"
                style={{ marginBottom: 0 }}
                placeholder="Paste Flipkart / Amazon Product Review URL..."
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
              />
              <button
                className="btn btn-start"
                style={{ whiteSpace: "nowrap" }}
                onClick={() => handleScrape()}
                disabled={loadingScrape || !scrapeUrl.trim()}
              >
                {loadingScrape ? (
                  <>
                    <span className="spinner" />
                    Scraping…
                  </>
                ) : (
                  "🕷️ Scrape & Analyze"
                )}
              </button>
            </div>
            {errorScrape && <p className="error-msg" style={{ marginTop: 10 }}>⚠ {errorScrape}</p>}
          </div>

          {/* Loading status */}
          {loadingScrape && (
            <div className="summary-panel" style={{ textStyle: "center", textAlign: "center" }}>
              <p className="status-label">
                <span className="spinner" style={{ marginRight: 8 }} />
                Scraping product reviews &amp; running Gemini aspect sentiment analysis…
              </p>
            </div>
          )}

          {/* Scrape Result Dashboard */}
          {scrapeResult && !loadingScrape && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Product Header Banner */}
              <div className="summary-panel">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <span style={{ fontSize: "0.78rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>
                      {scrapeResult.platform} Product Insights
                    </span>
                    <h2 style={{ fontSize: "1.3rem", marginTop: 4, marginBottom: 4 }}>
                      {scrapeResult.product_name}
                    </h2>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      Analyzed {scrapeResult.total_scraped} reviews
                    </span>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block" }}>Overall Score</span>
                    <span className={`sentiment-badge ${scrapeResult.overall_sentiment.toLowerCase()}`} style={{ fontSize: "1rem", padding: "4px 14px", borderRadius: 16 }}>
                      {sentimentEmoji(scrapeResult.overall_sentiment.toLowerCase())} {scrapeResult.overall_sentiment}
                    </span>
                  </div>
                </div>

                {/* Aspect Matrix breakdown */}
                {Object.keys(scrapeResult.aspect_matrix).length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    <h4 style={{ fontSize: "0.95rem", marginBottom: 12, color: "#ffffff" }}>🏷 Aspect Sentiment Matrix</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      {Object.entries(scrapeResult.aspect_matrix).map(([aspName, counts]) => (
                        <div key={aspName} className="aspect-card" style={{ background: "var(--surface-alt)" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#ffffff" }}>{aspName}</span>
                          <div style={{ display: "flex", gap: 10, fontSize: "0.8rem", marginTop: 6 }}>
                            <span style={{ color: "#3fb950" }}>👍 {counts.positive}</span>
                            <span style={{ color: "#f85149" }}>👎 {counts.negative}</span>
                            <span style={{ color: "#a0a0a0" }}>😐 {counts.neutral}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Scraped Reviews Feed */}
              <div className="summary-panel">
                <h3 style={{ fontSize: "1.1rem", marginBottom: 14 }}>💬 Scraped Product Reviews ({scrapeResult.reviews.length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {scrapeResult.reviews.map((rev, i) => (
                    <div key={i} className="transcript-card" style={{ background: "var(--surface-alt)", padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#ffffff" }}>{rev.user}</span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: "0.8rem", color: "#d29922", fontWeight: 700 }}>{rev.rating}</span>
                          <span style={{ fontSize: "0.75rem", background: "var(--border)", padding: "2px 8px", borderRadius: 10, color: "var(--text-secondary)" }}>
                            {rev.source}
                          </span>
                        </div>
                      </div>

                      <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
                        "{rev.text}"
                      </p>

                      {rev.analysis && rev.analysis.aspects && rev.analysis.aspects.length > 0 && (
                        <div className="aspects-list">
                          {rev.analysis.aspects.map((asp, idx) => (
                            <div key={idx} style={{ fontSize: "0.82rem", background: "var(--bg)", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                              <span style={{ fontWeight: 600, marginRight: 6 }}>{asp.aspect}:</span>
                              <span className={`sentiment-badge ${asp.sentiment}`} style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
                                {asp.sentiment}
                              </span>
                              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{asp.reasoning}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
