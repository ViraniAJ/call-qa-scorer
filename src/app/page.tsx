"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  DEFAULT_SCORECARD,
  GOOD_TRANSCRIPT,
  BAD_TRANSCRIPT,
  parseScorecardFromText,
} from "@/lib/scorecard";
import type { Scorecard, ScorecardSection, ScoringResult, ScoreItem } from "@/lib/scorecard";

// ── Palette & Fonts ─────────────────────────────────────────────────────
const P = {
  bg: "#0c0f14",
  surface: "#141820",
  surfaceAlt: "#1a1f2b",
  border: "#252b3a",
  borderLight: "#2f3748",
  accent: "#4ee1a0",
  accentDim: "#2a7d5a",
  danger: "#f75555",
  dangerDim: "#7a2a2a",
  warn: "#f0b232",
  warnDim: "#7a5c1a",
  text: "#e2e6ee",
  textDim: "#8891a5",
  textMuted: "#5a6275",
  white: "#ffffff",
};
const F = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// ── Small components ────────────────────────────────────────────────────

function Badge({ children, color = P.accent }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block", padding: "2px 10px", borderRadius: 4,
        fontSize: 11, fontWeight: 700, fontFamily: F, color,
        background: color + "18", border: `1px solid ${color}40`,
        letterSpacing: 1, textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function ScoreGauge({
  score, total, passed, hasCriticalFail,
}: {
  score: number; total: number; passed: boolean; hasCriticalFail: boolean;
}) {
  const pct = hasCriticalFail ? 0 : Math.round((score / total) * 100);
  const color = hasCriticalFail ? P.danger : passed ? P.accent : pct >= 70 ? P.warn : P.danger;
  const C = 2 * Math.PI * 54;
  const offset = C - (pct / 100) * C;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="140" height="140" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke={P.border} strokeWidth="8" />
        <circle
          cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
        <text x="60" y="55" textAnchor="middle" fill={color} fontSize="28" fontWeight="800" fontFamily={F}>
          {hasCriticalFail ? "0" : score}
        </text>
        <text x="60" y="72" textAnchor="middle" fill={P.textDim} fontSize="11" fontFamily={F}>/ {total}</text>
      </svg>
      <div style={{ marginTop: 6 }}>
        {hasCriticalFail ? <Badge color={P.danger}>CRITICAL FAIL</Badge> : passed ? <Badge color={P.accent}>PASSED</Badge> : <Badge color={P.danger}>FAILED</Badge>}
      </div>
    </div>
  );
}

function SectionResults({ section, scores }: { section: ScorecardSection; scores: ScoreItem[] }) {
  const [open, setOpen] = useState(true);
  const sectionScores = scores.filter((s) => section.items.some((i) => i.id === s.id));
  const earned = sectionScores.reduce((t, s) => t + s.awarded, 0);
  const possible = section.items.reduce((t, i) => t + i.points, 0);
  return (
    <div style={{ marginBottom: 12, border: `1px solid ${P.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px", background: P.surfaceAlt, cursor: "pointer", userSelect: "none",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: F, color: P.text }}>
          {open ? "▾" : "▸"} {section.name}
        </span>
        <span style={{
          fontFamily: F, fontSize: 13, fontWeight: 700,
          color: earned === possible ? P.accent : earned === 0 ? P.danger : P.warn,
        }}>
          {earned}/{possible}
        </span>
      </div>
      {open && (
        <div style={{ padding: "8px 0" }}>
          {section.items.map((item) => {
            const sc = sectionScores.find((s) => s.id === item.id);
            if (!sc) return null;
            const rc = sc.result === "Y" ? P.accent : sc.result === "N" ? P.danger : sc.result === "Partial" ? P.warn : P.textMuted;
            return (
              <div key={item.id} style={{ padding: "8px 16px", borderBottom: `1px solid ${P.border}08` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontFamily: F, color: P.text, fontWeight: 600 }}>{item.label}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontFamily: F, color: rc, fontWeight: 700 }}>{sc.result}</span>
                    <span style={{ fontSize: 12, fontFamily: F, color: rc, fontWeight: 700 }}>{sc.awarded}/{sc.maxPoints}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, fontFamily: F, color: P.textDim, lineHeight: 1.5 }}>{sc.reasoning}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<"score" | "settings" | "samples">("score");
  const [scorecard, setScorecard] = useState<Scorecard>(DEFAULT_SCORECARD);
  const [transcript, setTranscript] = useState("");
  const [results, setResults] = useState<ScoringResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scorecardSource, setScorecardSource] = useState("default");
  const fileRef = useRef<HTMLInputElement>(null);
  const scFileRef = useRef<HTMLInputElement>(null);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [dragT, setDragT] = useState(false);
  const [dragS, setDragS] = useState(false);

  const loadingMsgs = [
    "Parsing transcript...",
    "Evaluating compliance items...",
    "Checking critical fail conditions...",
    "Scoring against rubric...",
    "Compiling results...",
  ];

  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setLoadingIdx((p) => (p + 1) % loadingMsgs.length), 2200);
    return () => clearInterval(iv);
  }, [loading, loadingMsgs.length]);

  // ── Scoring via API route ───────────────────────────────────────────
  const handleScore = useCallback(async () => {
    if (!transcript.trim()) { setError("Please paste or upload a transcript first."); return; }
    setError(null); setLoading(true); setLoadingIdx(0); setResults(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, scorecard }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      setResults(await res.json());
    } catch (err: unknown) {
      setError("Scoring failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [transcript, scorecard]);

  // ── File helpers ────────────────────────────────────────────────────
  const readFile = (file: File): Promise<string> =>
    new Promise((res, rej) => { const r = new FileReader(); r.onload = (e) => res(e.target?.result as string); r.onerror = rej; r.readAsText(file); });

  const onTranscriptFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "csv", "text"].includes(ext || "")) { setError("Please use a .txt or .csv file."); return; }
    setTranscript(await readFile(file)); setResults(null); setError(null);
  };

  const onScorecardFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "csv", "text"].includes(ext || "")) { setError("Please use a .txt or .csv scorecard file."); return; }
    const parsed = parseScorecardFromText(await readFile(file));
    if (parsed) { setScorecard(parsed); setScorecardSource(file.name); setError(null); }
    else { setError("Could not parse scorecard. Use CSV format: Section, Item, Criteria, Points"); }
  };

  const prevent = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const btn: React.CSSProperties = {
    fontFamily: F, fontSize: 12, fontWeight: 700, border: "none",
    borderRadius: 6, cursor: "pointer", padding: "10px 20px", letterSpacing: 0.5,
  };

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.text, fontFamily: F }}>
      {/* ─── Header ─────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${P.border}`, padding: "20px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: `linear-gradient(180deg, ${P.surfaceAlt} 0%, ${P.bg} 100%)`,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: P.accent, letterSpacing: -0.5 }}>▧ CALL QA SCORER</div>
          <div style={{ fontSize: 11, color: P.textMuted, marginTop: 2 }}>Transcript quality analysis engine</div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {(["score", "settings", "samples"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              ...btn, background: tab === t ? P.accent + "20" : "transparent",
              color: tab === t ? P.accent : P.textDim,
              border: tab === t ? `1px solid ${P.accent}40` : "1px solid transparent",
              padding: "8px 16px", textTransform: "uppercase",
            }}>
              {t === "score" ? "⬡ Score" : t === "settings" ? "⚙ Settings" : "◉ Samples"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px" }}>
        {/* ═══════════════ SCORE TAB ═══════════════ */}
        {tab === "score" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 4 }}>Call Transcript</div>
                <div style={{ fontSize: 11, color: P.textMuted }}>Paste, upload, or drag &amp; drop a .txt / .csv file</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input ref={fileRef} type="file" accept=".txt,.csv,.text" onChange={(e) => e.target.files?.[0] && onTranscriptFile(e.target.files[0])} style={{ display: "none" }} />
                <button onClick={() => fileRef.current?.click()} style={{ ...btn, background: P.surfaceAlt, color: P.textDim, border: `1px solid ${P.border}`, padding: "8px 14px" }}>↑ Upload</button>
                <button onClick={() => { setTranscript(""); setResults(null); }} style={{ ...btn, background: P.surfaceAlt, color: P.textDim, border: `1px solid ${P.border}`, padding: "8px 14px" }}>Clear</button>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { prevent(e); setDragT(true); }}
              onDragEnter={(e) => { prevent(e); setDragT(true); }}
              onDragLeave={(e) => { prevent(e); setDragT(false); }}
              onDrop={(e) => { prevent(e); setDragT(false); e.dataTransfer.files?.[0] && onTranscriptFile(e.dataTransfer.files[0]); }}
              style={{
                position: "relative", borderRadius: 8,
                border: dragT ? `2px dashed ${P.accent}` : `1px solid ${P.border}`,
                background: dragT ? P.accent + "08" : "transparent", transition: "all 0.2s ease",
              }}
            >
              {dragT && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: P.accent + "12", borderRadius: 8, zIndex: 10, pointerEvents: "none",
                }}>
                  <div style={{
                    padding: "12px 24px", background: P.surface, border: `1px solid ${P.accent}60`,
                    borderRadius: 8, fontSize: 13, fontWeight: 700, color: P.accent, fontFamily: F,
                  }}>↓ Drop transcript file here</div>
                </div>
              )}
              <textarea
                value={transcript} onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your call transcript here, or drag & drop a .txt / .csv file..."
                rows={12}
                style={{
                  width: "100%", background: P.surface, border: "none", borderRadius: 8,
                  padding: 16, color: P.text, fontFamily: F, fontSize: 12,
                  lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <div style={{ fontSize: 11, color: P.textMuted }}>
                Scoring against: <span style={{ color: P.accent, fontWeight: 600 }}>{scorecard.title}</span>{" "}
                ({scorecard.totalPossible} pts, pass: {scorecard.passingThreshold})
              </div>
              <button onClick={handleScore} disabled={loading || !transcript.trim()} style={{
                ...btn, background: loading ? P.accentDim : P.accent, color: P.bg,
                padding: "12px 32px", fontSize: 13, opacity: !transcript.trim() ? 0.4 : 1,
              }}>
                {loading ? "⟳ Scoring..." : "▶ Score Transcript"}
              </button>
            </div>

            {loading && (
              <div style={{ marginTop: 20, padding: 20, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8, textAlign: "center" }}>
                <div style={{
                  width: 40, height: 40, border: `3px solid ${P.border}`, borderTopColor: P.accent,
                  borderRadius: "50%", margin: "0 auto 12px", animation: "spin 1s linear infinite",
                }} />
                <div style={{ fontSize: 12, color: P.accent, fontWeight: 600 }}>{loadingMsgs[loadingIdx]}</div>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: 16, padding: "12px 16px", background: P.dangerDim + "30",
                border: `1px solid ${P.danger}40`, borderRadius: 8, fontSize: 12, color: P.danger,
              }}>{error}</div>
            )}

            {/* ─── Results ─────────────────────────────────── */}
            {results && (
              <div style={{ marginTop: 24 }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "160px 1fr", gap: 24,
                  padding: 24, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, marginBottom: 20,
                }}>
                  <ScoreGauge score={results.totalScore} total={scorecard.totalPossible} passed={results.passed} hasCriticalFail={results.hasCriticalFail} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: P.text, marginBottom: 8 }}>Assessment Summary</div>
                    <div style={{ fontSize: 12, color: P.textDim, lineHeight: 1.7, marginBottom: 16 }}>{results.summary}</div>

                    {results.hasCriticalFail && (
                      <div style={{ padding: "10px 14px", background: P.danger + "15", border: `1px solid ${P.danger}40`, borderRadius: 6, marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: P.danger, marginBottom: 6, textTransform: "uppercase" }}>⚠ Critical Failures Detected</div>
                        {results.criticalFails.filter((cf) => cf.triggered).map((cf, i) => (
                          <div key={i} style={{ fontSize: 11, color: P.text, marginBottom: 4, lineHeight: 1.5 }}>
                            • {cf.condition} — <span style={{ color: P.danger }}>{cf.evidence}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: P.accent, marginBottom: 6, textTransform: "uppercase" }}>Strengths</div>
                        {results.strengths?.map((s, i) => (
                          <div key={i} style={{ fontSize: 11, color: P.textDim, marginBottom: 3, lineHeight: 1.5 }}>✓ {s}</div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: P.warn, marginBottom: 6, textTransform: "uppercase" }}>Opportunities</div>
                        {results.opportunities?.map((o, i) => (
                          <div key={i} style={{ fontSize: 11, color: P.textDim, marginBottom: 3, lineHeight: 1.5 }}>→ {o}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 12 }}>Detailed Scoring</div>
                {scorecard.sections.map((section) => (
                  <SectionResults key={section.name} section={section} scores={results.scores} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ SETTINGS TAB ═══════════════ */}
        {tab === "settings" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: P.text, marginBottom: 4 }}>Scorecard Configuration</div>
            <div style={{ fontSize: 12, color: P.textDim, marginBottom: 20, lineHeight: 1.6 }}>
              Upload a custom scorecard or use the default SkyBridge scorecard. Accepted formats: .txt or .csv with columns: Section, Item, Criteria, Points.
            </div>

            <div style={{ padding: 20, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.text }}>Active Scorecard</div>
                  <div style={{ fontSize: 12, color: P.accent, marginTop: 2 }}>{scorecard.title}</div>
                </div>
                <Badge color={scorecardSource === "default" ? P.accent : P.warn}>
                  {scorecardSource === "default" ? "DEFAULT" : "CUSTOM"}
                </Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  { val: scorecard.totalPossible, label: "Total Points", color: P.accent },
                  { val: scorecard.passingThreshold, label: "Pass Threshold", color: P.warn },
                  { val: scorecard.sections.reduce((t, s) => t + s.items.length, 0), label: "Scoring Items", color: P.text },
                ].map((m) => (
                  <div key={m.label} style={{ padding: 12, background: P.surfaceAlt, borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.val}</div>
                    <div style={{ fontSize: 10, color: P.textMuted, textTransform: "uppercase" }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Scorecard drop zone */}
              <div
                onDragOver={(e) => { prevent(e); setDragS(true); }}
                onDragEnter={(e) => { prevent(e); setDragS(true); }}
                onDragLeave={(e) => { prevent(e); setDragS(false); }}
                onDrop={(e) => { prevent(e); setDragS(false); e.dataTransfer.files?.[0] && onScorecardFile(e.dataTransfer.files[0]); }}
                style={{
                  padding: 16, borderRadius: 8, marginBottom: 12,
                  border: dragS ? `2px dashed ${P.accent}` : `2px dashed ${P.border}`,
                  background: dragS ? P.accent + "08" : P.surfaceAlt,
                  textAlign: "center", transition: "all 0.2s ease",
                }}
              >
                {dragS ? (
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.accent, fontFamily: F, padding: "8px 0" }}>
                    ↓ Drop scorecard file here
                  </div>
                ) : (
                  <div style={{ padding: "4px 0" }}>
                    <div style={{ fontSize: 12, color: P.textDim, marginBottom: 4 }}>Drag &amp; drop a scorecard file here</div>
                    <div style={{ fontSize: 10, color: P.textMuted }}>.txt or .csv — CSV format: Section, Item, Criteria, Points</div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <input ref={scFileRef} type="file" accept=".txt,.csv,.text" onChange={(e) => e.target.files?.[0] && onScorecardFile(e.target.files[0])} style={{ display: "none" }} />
                <button onClick={() => scFileRef.current?.click()} style={{ ...btn, background: P.accent, color: P.bg, flex: 1 }}>
                  ↑ Browse &amp; Upload Scorecard
                </button>
                <button onClick={() => { setScorecard(DEFAULT_SCORECARD); setScorecardSource("default"); }} style={{ ...btn, background: P.surfaceAlt, color: P.textDim, border: `1px solid ${P.border}` }}>
                  Reset to Default
                </button>
              </div>
            </div>

            {/* Preview */}
            <div style={{ padding: 20, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 16 }}>Current Scorecard Items</div>
              {scorecard.sections.map((section) => (
                <div key={section.name} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: P.accent,
                    padding: "6px 12px", background: P.accent + "10", borderRadius: 4, marginBottom: 8,
                  }}>
                    {section.name} — {section.items.reduce((t, i) => t + i.points, 0)} pts
                  </div>
                  {section.items.map((item) => (
                    <div key={item.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                      padding: "6px 12px", fontSize: 11, borderBottom: `1px solid ${P.border}30`,
                    }}>
                      <div style={{ flex: 1, marginRight: 12 }}>
                        <span style={{ fontWeight: 600, color: P.text }}>{item.label}</span>
                        <span style={{ color: P.textMuted }}> — {item.criteria}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: P.warn, whiteSpace: "nowrap" }}>{item.points} pts</span>
                    </div>
                  ))}
                </div>
              ))}
              {scorecard.criticalFails.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: P.danger,
                    padding: "6px 12px", background: P.danger + "10", borderRadius: 4, marginBottom: 8,
                  }}>Critical Fail Conditions</div>
                  {scorecard.criticalFails.map((cf, i) => (
                    <div key={i} style={{ padding: "4px 12px", fontSize: 11, color: P.textDim, lineHeight: 1.5 }}>⚠ {cf}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════ SAMPLES TAB ═══════════════ */}
        {tab === "samples" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: P.text, marginBottom: 4 }}>Sample Transcripts</div>
            <div style={{ fontSize: 12, color: P.textDim, marginBottom: 20, lineHeight: 1.6 }}>
              Load a pre-built sample transcript to test the scoring engine against the active scorecard.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { type: "good" as const, label: "✓ Compliant Call", badge: "HIGH SCORE", color: P.accent, text: "Agent follows proper identification, security verification, all compliance disclosures, and proper denial handling. Demonstrates best practices across all scorecard sections." },
                { type: "bad" as const, label: "✗ Non-Compliant Call", badge: "CRITICAL FAILS", color: P.danger, text: "Agent misidentifies their company, skips security verification, promises approval likelihood, guarantees settlement timelines, coaches answers, and mishandles denial." },
              ].map((s) => (
                <div key={s.type} style={{ padding: 20, background: P.surface, border: `1px solid ${s.color}30`, borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</div>
                    <Badge color={s.color}>{s.badge}</Badge>
                  </div>
                  <div style={{ fontSize: 11, color: P.textDim, lineHeight: 1.6, marginBottom: 16, minHeight: 80 }}>{s.text}</div>
                  <button
                    onClick={() => { setTranscript(s.type === "good" ? GOOD_TRANSCRIPT : BAD_TRANSCRIPT); setResults(null); setTab("score"); }}
                    style={{ ...btn, background: s.color + "20", color: s.color, border: `1px solid ${s.color}40`, width: "100%" }}
                  >
                    Load {s.type === "good" ? "Good" : "Bad"} Sample
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, padding: 16, background: P.surfaceAlt, borderRadius: 8, border: `1px solid ${P.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.text, marginBottom: 8 }}>Upload Format Guide</div>
              <div style={{ fontSize: 11, color: P.textDim, lineHeight: 1.7 }}>
                <strong style={{ color: P.text }}>Transcript files:</strong> Plain text (.txt) or CSV (.csv). Format should be readable dialog — &quot;Agent:&quot; and &quot;Customer:&quot; prefixed lines, or a continuous conversation.
              </div>
              <div style={{ fontSize: 11, color: P.textDim, lineHeight: 1.7, marginTop: 8 }}>
                <strong style={{ color: P.text }}>Scorecard files:</strong> CSV with columns: Section, Item, Criteria, Points. Or structured text with section headers followed by items with point values (e.g., &quot;Identification - 5 pts&quot;).
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
