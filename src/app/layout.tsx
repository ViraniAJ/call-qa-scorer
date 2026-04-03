import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Call QA Scorer — Transcript Quality Analysis",
  description:
    "AI-powered call transcript scoring utility. Upload transcripts, evaluate against customizable scorecards, and get detailed compliance reports.",
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
