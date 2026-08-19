import Link from "next/link";
import { Mic, BarChart3, ArrowRight } from "lucide-react";

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
          <div className="hub-icon">
            <Mic size={32} />
          </div>
          <h2>Survey Agent</h2>
          <p>
            Interactive voice interview assistant powered by Gemini 3.1 &amp; Murf TTS.
            Includes user transcript saving &amp; Admin Dashboard.
          </p>
          <span className="hub-btn">
            Launch Survey Agent <ArrowRight size={16} style={{ marginLeft: 6 }} />
          </span>
        </Link>

        {/* Module 2 Card */}
        <Link href="/sentiment" className="hub-card">
          <div className="hub-icon">
            <BarChart3 size={32} />
          </div>
          <h2>Sentiment Analysis Bot</h2>
          <p>
            Human-in-the-Loop Web Scraper &amp; aspect-level sentiment analysis engine powered by Gemini 3.1.
            Extracts feature sentiment &amp; reasoning from customer reviews.
          </p>
          <span className="hub-btn">
            Launch Sentiment Bot <ArrowRight size={16} style={{ marginLeft: 6 }} />
          </span>
        </Link>
      </div>
    </main>
  );
}
