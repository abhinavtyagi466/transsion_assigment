import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transsion Assignment — AI Modules Portal",
  description: "Unified AI Portal featuring Voice Survey Agent and Sentiment Analysis Bot",
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
