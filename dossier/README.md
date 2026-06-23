# Dossier — interview recon agent

Give it a company + role; it researches the web live (Claude + Tavily, agentic tool-use loop) and streams a one-page interview prep brief.

## Run locally
1. `npm install`
2. `cp .env.local.example .env.local` and fill in:
   - `ANTHROPIC_API_KEY` — from console.anthropic.com
   - `TAVILY_API_KEY` — from tavily.com (free tier is generous)
3. `npm run dev` → http://localhost:3000

## Deploy to Vercel
1. Push to GitHub.
2. Import the repo at vercel.com (auto-detects Next.js).
3. Add both env vars (`ANTHROPIC_API_KEY`, `TAVILY_API_KEY`) under Settings → Environment Variables.
4. Deploy.

## How it works
`app/api/prep/route.ts` runs the same agent loop as the original Python: Claude calls a `web_search` tool, Tavily answers, repeat until Claude writes the brief. Each step is streamed to the browser as NDJSON so you watch the agent search in real time. The loop is capped at 6 turns so it can't run away.
