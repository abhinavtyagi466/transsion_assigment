import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Interview Assistant — Transsion",
  description:
    "AI-powered voice interview assistant using Gemini Live. Speak naturally and receive real-time transcription and post-interview summaries.",
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
