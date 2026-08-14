import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentiment Chatbot — Transsion",
  description:
    "Paste a product review and instantly get feature-level sentiment analysis powered by Gemini. Understand what customers love and dislike at a granular level.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
