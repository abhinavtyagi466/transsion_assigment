import Link from "next/link";

export default function HubPage() {
  return (
    <main className="hub-page">
      <header className="hub-header">
        <h1>Transsion AI Platform</h1>
        <p>Select an AI module to launch</p>
      </header>

      <div className="hub-grid">
        {/* Module 1 Card */}
        <Link href="/survey" className="hub-card">
          <div className="hub-icon">🎙</div>
          <h2>Survey Agent</h2>
          <p>
            Interactive voice interview assistant powered by Gemini 3.1 &amp; Murf TTS.
            Includes user transcript saving &amp; Admin Dashboard.
          </p>
          <span className="hub-btn">Launch Survey Agent →</span>
        </Link>

        {/* Module 2 Card */}
        <Link href="/sentiment" className="hub-card">
          <div className="hub-icon">📊</div>
          <h2>Sentiment Analysis Bot</h2>
          <p>
            Aspect-level sentiment analysis engine powered by Gemini 3.1.
            Extracts feature sentiment &amp; reasoning from customer reviews.
          </p>
          <span className="hub-btn">Launch Sentiment Bot →</span>
        </Link>
      </div>
    </main>
  );
}
