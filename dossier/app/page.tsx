"use client";
// app/page.tsx
import { useRef, useState } from "react";
import { marked } from "marked";

type TraceLine =
  | { kind: "status"; text: string }
  | { kind: "search"; query: string }
  | { kind: "sources"; count: number };

export default function Home() {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jd, setJd] = useState("");
  const [running, setRunning] = useState(false);
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [briefHtml, setBriefHtml] = useState("");
  const [error, setError] = useState("");
  const searchCount = useRef(0);

  async function run() {
    setRunning(true);
    setTrace([]);
    setBriefHtml("");
    setError("");
    searchCount.current = 0;

    try {
      const res = await fetch("/api/prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, role, jd }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "The agent couldn't start. Check your details and try again.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === "status") setTrace((t) => [...t, { kind: "status", text: evt.text }]);
          else if (evt.type === "search") {
            searchCount.current += 1;
            setTrace((t) => [...t, { kind: "search", query: evt.query }]);
          } else if (evt.type === "sources") setTrace((t) => [...t, { kind: "sources", count: evt.count }]);
          else if (evt.type === "brief") setBriefHtml(await marked.parse(evt.markdown));
          else if (evt.type === "error") setError(evt.message);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  }

  const canRun = company.trim() && role.trim() && !running;
  const showTrace = running || trace.length > 0;

  return (
    <>
      <section className="hero">
        <h1>
          Walk in <span className="hl">already briefed.</span>
        </h1>
        <p>
          Give Dossier a company and a role. It researches the web live — the way you would the
          night before — and hands you a one-page prep brief.
        </p>

        <div className="panel">
          <div className="fieldrow">
            <div className="field">
              <label>Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Razorpay" />
            </div>
            <div className="field">
              <label>Role</label>
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Product Marketing Manager: AI & Tech" />
            </div>
          </div>
          <div className="field">
            <label>Job description <span style={{ textTransform: "none", color: "var(--faint)" }}>— optional, but sharpens the brief</span></label>
            <textarea value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the JD here…" />
          </div>
          <div className="run">
            <button className="btn" onClick={run} disabled={!canRun}>
              {running ? "Researching…" : "Build my brief"}
            </button>
            <span className="hint">Takes ~20–40s while the agent searches.</span>
          </div>
        </div>
      </section>

      {showTrace && (
        <section className="trace">
          <div className={"trace-head" + (running ? " live" : "")}>
            <span className="pulse" />
            <span className="label">{running ? "Agent researching" : "Research complete"}</span>
            <span className="count">{searchCount.current} searches</span>
          </div>
          <div className="trace-body">
            {trace.map((l, i) => {
              if (l.kind === "search")
                return (
                  <div className="line" key={i}>
                    <span className="glyph">→</span>
                    <span className="txt">searching <span className="sub">“{l.query}”</span></span>
                  </div>
                );
              if (l.kind === "sources")
                return (
                  <div className="line status" key={i}>
                    <span className="glyph">✓</span>
                    <span className="txt">read {l.count} sources</span>
                  </div>
                );
              return (
                <div className="line status" key={i}>
                  <span className="glyph">·</span>
                  <span className="txt">{l.text}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {error && <div className="err">{error}</div>}

      {briefHtml && (
        <section className="brief">
          <div className="kicker">Interview brief</div>
          <div dangerouslySetInnerHTML={{ __html: briefHtml }} />
          <div className="briefbar">
            <button className="btn ghost" onClick={() => navigator.clipboard.writeText(briefHtml.replace(/<[^>]+>/g, ""))}>
              Copy as text
            </button>
            <button className="btn ghost" onClick={() => { setBriefHtml(""); setTrace([]); }}>
              New brief
            </button>
          </div>
        </section>
      )}
    </>
  );
}
