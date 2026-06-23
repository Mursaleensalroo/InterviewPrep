// app/api/prep/route.ts
// The interview-prep agent, ported from Python. Runs an agentic tool-use loop
// (Claude + Tavily web search) and STREAMS each step to the browser as NDJSON
// so the user watches the agent research in real time, then receives the brief.
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 6; // bound the loop so it can't run away

const tools: Anthropic.Tool[] = [
  {
    name: "web_search",
    description: "Search the web for current information about a company, role, or topic.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "The search query" } },
      required: ["query"],
    },
  },
];

async function tavilySearch(query: string): Promise<string> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 3,
      search_depth: "basic",
    }),
  });
  if (!res.ok) return `(search failed: HTTP ${res.status})`;
  const data = await res.json();
  const results = (data.results ?? []) as { content?: string }[];
  return results.map((r) => r.content ?? "").join("\n") || "(no results)";
}

export async function POST(req: NextRequest) {
  const { company, role, jd } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Server missing ANTHROPIC_API_KEY." }, { status: 500 });
  }
  if (!process.env.TAVILY_API_KEY) {
    return Response.json({ error: "Server missing TAVILY_API_KEY." }, { status: 500 });
  }
  if (!company || !role) {
    return Response.json({ error: "Add a company and a role." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const messages: Anthropic.MessageParam[] = [
          {
            role: "user",
            content: `You are an interview-prep agent. Prepare a one-page brief for a candidate interviewing for the role of ${role} at ${company}.

Job description:
${jd || "(none provided)"}

Search the web as needed to understand the company, recent news, and what this role involves. Search multiple times if you need different information. When you have enough, write a one-page prep brief in clean Markdown with these sections:
1. What the company does
2. Recent relevant news
3. Likely interview themes
4. 5-6 probable questions, each with a short note on how to approach it.

Keep it tight and genuinely useful — no filler.`,
          },
        ];

        emit({ type: "status", text: "Reading the role and job description…" });

        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const response = await client.messages.create({
            model: MODEL,
            max_tokens: 2000,
            tools,
            messages,
          });

          if (response.stop_reason === "tool_use") {
            messages.push({ role: "assistant", content: response.content });
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of response.content) {
              if (block.type === "tool_use") {
                const query = (block.input as { query: string }).query;
                emit({ type: "search", query });
                const result = await tavilySearch(query);
                emit({ type: "sources", count: 3 });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: result,
                });
              }
            }
            messages.push({ role: "user", content: toolResults });
          } else {
            const text = response.content
              .filter((b): b is Anthropic.TextBlock => b.type === "text")
              .map((b) => b.text)
              .join("");
            emit({ type: "status", text: "Writing your brief…" });
            emit({ type: "brief", markdown: text });
            controller.close();
            return;
          }
        }

        // Loop hit its cap while still wanting to search — force a final synthesis.
        emit({ type: "status", text: "Wrapping up the brief…" });
        const final = await client.messages.create({
          model: MODEL,
          max_tokens: 2000,
          messages: [
            ...messages,
            { role: "user", content: "Stop searching and write the one-page brief now, in Markdown." },
          ],
        });
        const text = final.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        emit({ type: "brief", markdown: text });
        controller.close();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Something went wrong.";
        emit({ type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
