"use client";

/**
 * Module 2 — Sentiment Chatbot Page & Human-in-the-Loop Web Scraper (Clean Icon UI)
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Globe,
  MessageSquare,
  Search,
  ShieldCheck,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ShoppingCart,
  ArrowLeft,
  Bot,
  Sparkles,
  Smartphone,
  AlertCircle,
  X,
  RefreshCw,
  BarChart2
} from "lucide-react";

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
  phone_name?: string;
  url?: string;
  platform: string;
  product_name: string;
  is_live_scraped?: boolean;
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

function SentimentIcon({ sentiment }: { sentiment: string }) {
  if (sentiment === "positive") return <ThumbsUp size={14} className="text-green" />;
  if (sentiment === "negative") return <ThumbsDown size={14} className="text-red" />;
  return <Minus size={14} className="text-muted" />;
}

export default function SentimentChatbotPage() {
  const [activeTab, setActiveTab] = useState<"text" | "scraper">("scraper");

  // Single review state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [loadingText, setLoadingText] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Scraper Interactive Workflow State
  const [phoneName, setPhoneName] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<"Flipkart" | "Amazon">("Flipkart");
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
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

  /* ── 2. Scraper Agent Launch Trigger ────────────────── */
  function handleLaunchScraper() {
    if (!phoneName.trim()) return;
    setErrorScrape(null);
    setShowCaptchaModal(true);
  }

  /* ── 3. Execute Scrape Post-CAPTCHA Clearance ───────── */
  async function executeScrapeAfterCaptcha() {
    setShowCaptchaModal(false);
    setLoadingScrape(true);
    setScrapeResult(null);

    try {
      const res = await fetch("/api/scrape-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_name: phoneName.trim(),
          platform: selectedPlatform,
          max_reviews: 4,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`/api/scrape-phone returned ${res.status}: ${errBody}`);
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
        <Link href="/" className="back-btn">
          <ArrowLeft size={16} style={{ marginRight: 6 }} /> Back to Platform Hub
        </Link>
      </div>

      <header className="header">
        <h1>Sentiment Analysis Bot</h1>
        <p>
          Interactive Human-in-the-Loop Scraper &amp; Aspect-Level Sentiment Analysis
        </p>

        {/* Mode Switcher */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
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
            <Globe size={16} style={{ marginRight: 6 }} /> Scrape Phone Reviews
          </button>
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
            <MessageSquare size={16} style={{ marginRight: 6 }} /> Single Review Text
          </button>
        </div>
      </header>

      {/* ── TAB 1: HUMAN-IN-THE-LOOP SCRAPER WORKFLOW ────────── */}
      {activeTab === "scraper" && (
        <section style={{ width: "100%", maxWidth: 720 }}>
          <div className="admin-container" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Bot size={20} color="#58a6ff" />
              <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Agent Scraper Control Panel</h2>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: 20 }}>
              Enter any smartphone model name and select a platform. The agent will navigate to the site, prompt for CAPTCHA verification, search for the phone, extract reviews, and run Gemini aspect sentiment analysis.
            </p>

            {/* Input Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600 }}>
                  1. Phone Model Name:
                </label>
                <div style={{ position: "relative" }}>
                  <Smartphone size={18} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    className="admin-input"
                    style={{ marginBottom: 0, paddingLeft: 38 }}
                    placeholder="e.g. Tecno Camon 20 Pro, Infinix Note 30, itel P55 5G, iPhone 16..."
                    value={phoneName}
                    onChange={(e) => setPhoneName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600 }}>
                  2. Target Platform:
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      background: selectedPlatform === "Flipkart" ? "#ffffff" : "var(--surface-alt)",
                      color: selectedPlatform === "Flipkart" ? "#000000" : "var(--text-primary)",
                      border: "1px solid var(--border)"
                    }}
                    onClick={() => setSelectedPlatform("Flipkart")}
                  >
                    <ShoppingCart size={16} style={{ marginRight: 6 }} /> Flipkart
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      background: selectedPlatform === "Amazon" ? "#ffffff" : "var(--surface-alt)",
                      color: selectedPlatform === "Amazon" ? "#000000" : "var(--text-primary)",
                      border: "1px solid var(--border)"
                    }}
                    onClick={() => setSelectedPlatform("Amazon")}
                  >
                    <ShoppingCart size={16} style={{ marginRight: 6 }} /> Amazon
                  </button>
                </div>
              </div>

              <button
                className="btn btn-start"
                style={{ marginTop: 8, width: "100%", justifyContent: "center", padding: "14px" }}
                onClick={handleLaunchScraper}
                disabled={loadingScrape || !phoneName.trim()}
              >
                {loadingScrape ? (
                  <>
                    <span className="spinner" />
                    Agent Navigating &amp; Scraping…
                  </>
                ) : (
                  <>
                    <Search size={18} style={{ marginRight: 6 }} /> Launch Agent on {selectedPlatform}
                  </>
                )}
              </button>
            </div>

            {errorScrape && (
              <p className="error-msg" style={{ marginTop: 14 }}>
                <AlertCircle size={16} style={{ marginRight: 6, inlineSize: "fit-content" }} /> {errorScrape}
              </p>
            )}
          </div>

          {/* Loading status */}
          {loadingScrape && (
            <div className="summary-panel" style={{ textAlign: "center", padding: 28 }}>
              <p className="status-label" style={{ fontSize: "0.95rem" }}>
                <span className="spinner" style={{ marginRight: 10 }} />
                Agent is typing <strong>"{phoneName}"</strong> into {selectedPlatform} → Extracting customer reviews → Running Gemini aspect sentiment analysis…
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
                      {scrapeResult.platform} Scraped Intelligence
                    </span>
                    <h2 style={{ fontSize: "1.3rem", marginTop: 4, marginBottom: 4, color: "#ffffff" }}>
                      {scrapeResult.product_name}
                    </h2>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      Scraped &amp; Analyzed {scrapeResult.total_scraped} customer reviews
                    </span>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block" }}>Overall Score</span>
                    <span className={`sentiment-badge ${scrapeResult.overall_sentiment.toLowerCase()}`} style={{ fontSize: "0.95rem", padding: "4px 14px", borderRadius: 16 }}>
                      {scrapeResult.overall_sentiment}
                    </span>
                  </div>
                </div>

                {/* Aspect Matrix breakdown */}
                {Object.keys(scrapeResult.aspect_matrix).length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <BarChart2 size={16} color="#58a6ff" />
                      <h4 style={{ fontSize: "0.95rem", margin: 0, color: "#ffffff" }}>Aspect Sentiment Matrix</h4>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      {Object.entries(scrapeResult.aspect_matrix).map(([aspName, counts]) => (
                        <div key={aspName} className="aspect-card" style={{ background: "var(--surface-alt)" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#ffffff" }}>{aspName}</span>
                          <div style={{ display: "flex", gap: 10, fontSize: "0.8rem", marginTop: 6 }}>
                            <span style={{ color: "#3fb950", display: "flex", alignItems: "center", gap: 4 }}>
                              <ThumbsUp size={12} /> {counts.positive}
                            </span>
                            <span style={{ color: "#f85149", display: "flex", alignItems: "center", gap: 4 }}>
                              <ThumbsDown size={12} /> {counts.negative}
                            </span>
                            <span style={{ color: "#a0a0a0", display: "flex", alignItems: "center", gap: 4 }}>
                              <Minus size={12} /> {counts.neutral}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Scraped Reviews Feed */}
              <div className="summary-panel">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <MessageSquare size={18} color="#58a6ff" />
                  <h3 style={{ fontSize: "1.1rem", margin: 0 }}>Scraped Customer Reviews ({scrapeResult.reviews.length})</h3>
                </div>
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
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, color: "#ffffff" }}>{asp.aspect}</span>
                                <span className={`sentiment-badge ${asp.sentiment}`} style={{ fontSize: "0.7rem", padding: "1px 6px" }}>
                                  {asp.sentiment}
                                </span>
                              </div>
                              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>{asp.reasoning}</p>
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

      {/* ── TAB 2: SINGLE REVIEW TEXT ────────────────────────── */}
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
                        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                          <strong>Overall Sentiment:</strong>{" "}
                          <span className={`sentiment-badge ${msg.result.overall_sentiment}`} style={{ textTransform: "capitalize" }}>
                            {msg.result.overall_sentiment}
                          </span>
                        </div>
                        <div className="aspects-list">
                          {msg.result.aspects.map((a, i) => (
                            <div key={i} className="aspect-card">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span className="aspect-name">{a.aspect}</span>
                                <span className={`sentiment-badge ${a.sentiment}`}>
                                  {a.sentiment}
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

          {errorText && (
            <p className="error-msg" role="alert">
              <AlertCircle size={16} style={{ marginRight: 6 }} /> {errorText}
            </p>
          )}

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
                  <>
                    <Search size={16} style={{ marginRight: 6 }} /> Analyze Sentiment
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── HUMAN CAPTCHA CLEARANCE POPUP MODAL ────────────────── */}
      {showCaptchaModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
            backdropFilter: "blur(4px)"
          }}
        >
          <div
            className="admin-login-box"
            style={{
              maxWidth: 480,
              width: "100%",
              border: "1px solid #58a6ff",
              boxShadow: "0 10px 40px rgba(88, 166, 255, 0.2)",
              textAlign: "left"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <ShieldCheck size={28} color="#58a6ff" />
              <div>
                <h3 style={{ fontSize: "1.15rem", color: "#ffffff", margin: 0 }}>Human Verification Check</h3>
                <span style={{ fontSize: "0.8rem", color: "#58a6ff" }}>Agent navigating to {selectedPlatform}</span>
              </div>
            </div>

            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 18 }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-primary)", marginBottom: 8 }}>
                Agent is opening <strong>{selectedPlatform}</strong> and entering phone name:
              </p>
              <p style={{ fontSize: "1.05rem", fontWeight: 700, color: "#3fb950", margin: 0 }}>
                "{phoneName}"
              </p>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
              If CAPTCHA or bot verification is required by {selectedPlatform}, please clear it. Once verified, click below to signal the agent to resume scraping and analyze customer reviews.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn-start"
                style={{ flex: 1, justifyContent: "center", padding: "12px", background: "#3fb950", color: "#ffffff" }}
                onClick={executeScrapeAfterCaptcha}
              >
                <CheckCircle2 size={18} style={{ marginRight: 6 }} /> Clear CAPTCHA &amp; Resume Agent
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: "var(--surface-alt)", color: "var(--text-muted)" }}
                onClick={() => setShowCaptchaModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
