// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dossier — walk in already briefed",
  description: "An agent that researches the company and builds your interview prep brief.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="wrap">
          <header className="masthead">
            <div className="brand">
              <span className="dot" />
              <span className="name">Dossier</span>
            </div>
            <span className="tag">interview recon agent</span>
          </header>
          {children}
          <footer>
            <span>Dossier</span>
            <span className="mono">claude · live web research · one-page brief</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
