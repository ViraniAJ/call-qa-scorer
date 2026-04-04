"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  DEFAULT_SCORECARD,
  GOOD_TRANSCRIPT,
  BAD_TRANSCRIPT,
  parseScorecardFromText,
} from "@/lib/scorecard";
import { parseTranscriptFile } from "@/lib/transcript-parser";
import type { Scorecard, ScorecardSection, ScoringResult, ScoreItem } from "@/lib/scorecard";
import type { ParsedTranscript } from "@/lib/transcript-parser";

const P = {
  bg: "#0c0f14", surface: "#141820", surfaceAlt: "#1a1f2b",
  border: "#252b3a", borderLight: "#2f3748",
  accent: "#4ee1a0", accentDim: "#2a7d5a",
  danger: "#f75555", dangerDim: "#7a2a2a",
  warn: "#f0b232", warnDim: "#7a5c1a",
  text: "#e2e6ee", textDim: "#8891a5", textMuted: "#5a6275",
  white: "#ffffff", green: "#4ee1a0", yellow: "#f0b232", red: "#f75555",
};
const F = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

interface BatchRecord {
  transcript: ParsedTranscript;
  result: ScoringResult | null;
  status: "pending" | "scoring" | "done" | "error";
  error?: string;
}

function Badge({ children, color = P.accent }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 4,
      fontSize: 11, fontWeight: 700, fontFamily: F, color,
      background: color + "18", border: `1px solid ${color}40`,
      letterSpacing: 1, textTransform: "uppercase",
    }}>{children}</span>
  );
}

function ScoreGauge({ score, total, passed, hasCriticalFail }: {
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
        <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
          transform="rotate(-90 60 60)" style={{ transition: "stroke-dashoffset 1s ease-out" }} />
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
      <div onClick={() => setOpen(!open)} style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 16px", background: P.surfaceAlt, cursor: "pointer", userSelect: "none",
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: F, color: P.text }}>
          {open ? "▾" : "▸"} {section.name}
        </span>
        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700,
          color: earned === possible ? P.accent : earned === 0 ? P.danger : P.warn }}>
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

function ConversationView({ transcript, onBack }: { transcript: ParsedTranscript; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} style={{
        fontFamily: F, fontSize: 12, fontWeight: 600, color: P.accent,
        background: "transparent", border: "none", cursor: "pointer",
        padding: "8px 0", marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
      }}>← Back to results</button>
      <div style={{
        background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12,
        padding: "16px 0", maxHeight: "70vh", overflowY: "auto",
      }}>
        <div style={{ padding: "0 20px 12px", borderBottom: `1px solid ${P.border}`, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.text }}>{transcript.agentName}</div>
          <div style={{ fontSize: 10, color: P.textMuted }}>Call with {transcript.customerName} · {transcript.lines.length} messages</div>
        </div>
        <div style={{ padding: "0 16px" }}>
          {transcript.lines.map((line, i) => {
            const isAgent = line.role === "agent";
            return (
              <div key={i} style={{ display: "flex", justifyContent: isAgent ? "flex-end" : "flex-start", marginBottom: 8 }}>
                <div style={{
                  maxWidth: "75%", padding: "10px 14px",
                  borderRadius: isAgent ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: isAgent ? "#0b84fe" : P.surfaceAlt,
                  color: isAgent ? P.white : P.text,
                  fontSize: 12, fontFamily: F, lineHeight: 1.6,
                  border: isAgent ? "none" : `1px solid ${P.border}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: isAgent ? "rgba(255,255,255,0.7)" : P.textMuted }}>
                    {line.speaker}
                  </div>
                  {line.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BatchTable({ records, onSelect, scorecard }: {
  records: BatchRecord[]; onSelect: (idx: number) => void; scorecard: Scorecard;
}) {
  const getColor = (rec: BatchRecord) => {
    if (rec.status === "error") return P.danger;
    if (rec.status !== "done" || !rec.result) return P.textMuted;
    if (rec.result.hasCriticalFail) return P.red;
    if (rec.result.passed) return P.green;
    return P.yellow;
  };
  const getLabel = (rec: BatchRecord) => {
    if (rec.status === "pending") return "Pending";
    if (rec.status === "scoring") return "Scoring...";
    if (rec.status === "error") return "Error";
    if (!rec.result) return "—";
    if (rec.result.hasCriticalFail) return "Critical Fail";
    if (rec.result.passed) return "Passed";
    return "Needs Work";
  };
  return (
    <div style={{ border: `1px solid ${P.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "2fr 100px 100px 120px 90px",
        padding: "10px 16px", background: P.surfaceAlt, gap: 8,
        fontSize: 10, fontWeight: 700, color: P.textMuted, textTransform: "uppercase",
        letterSpacing: 1, fontFamily: F, borderBottom: `1px solid ${P.border}`,
      }}>
        <div>Transcript</div><div style={{ textAlign: "center" }}>Score</div>
        <div style={{ textAlign: "center" }}>Status</div><div style={{ textAlign: "center" }}>Agent</div>
        <div style={{ textAlign: "center" }}>Actions</div>
      </div>
      {records.map((rec, idx) => {
        const color = getColor(rec);
        const borderColor = rec.status !== "done" || !rec.result ? P.border : rec.result.hasCriticalFail ? P.red + "60" : rec.result.passed ? P.green + "60" : P.yellow + "60";
        return (
          <div key={idx} style={{
            display: "grid", gridTemplateColumns: "2fr 100px 100px 120px 90px",
            padding: "12px 16px", gap: 8, alignItems: "center",
            borderBottom: `1px solid ${P.border}`, borderLeft: `3px solid ${borderColor}`,
            background: P.surface, cursor: rec.status === "done" ? "pointer" : "default",
          }}
            onClick={() => rec.status === "done" && onSelect(idx)}
            onMouseEnter={(e) => { if (rec.status === "done") (e.currentTarget as HTMLElement).style.background = P.surfaceAlt; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = P.surface; }}
          >
            <div style={{ fontSize: 12, fontFamily: F, color: P.text, fontWeight: 600 }}>
              {rec.transcript.label}
              <div style={{ fontSize: 10, color: P.textMuted, marginTop: 2 }}>{rec.transcript.lines.length} messages</div>
            </div>
            <div style={{ textAlign: "center", fontSize: 16, fontWeight: 800, fontFamily: F, color }}>
              {rec.status === "done" && rec.result
                ? <>{rec.result.hasCriticalFail ? "0" : rec.result.totalScore}<span style={{ fontSize: 10, fontWeight: 500, color: P.textMuted }}>/{scorecard.totalPossible}</span></>
                : rec.status === "scoring" ? <span style={{ fontSize: 12 }}>⟳</span> : "—"}
            </div>
            <div style={{ textAlign: "center" }}><Badge color={color}>{getLabel(rec)}</Badge></div>
            <div style={{ textAlign: "center", fontSize: 11, fontFamily: F, color: P.textDim }}>{rec.transcript.agentName}</div>
            <div style={{ textAlign: "center" }}>
              {rec.status === "done" && (
                <button onClick={(e) => { e.stopPropagation(); onSelect(idx); }} style={{
                  fontFamily: F, fontSize: 10, fontWeight: 700, color: P.accent,
                  background: P.accent + "15", border: `1px solid ${P.accent}30`,
                  borderRadius: 4, padding: "4px 10px", cursor: "pointer",
                }}>View →</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecordDetail({ record, scorecard, onBack }: {
  record: BatchRecord; scorecard: Scorecard; onBack: () => void;
}) {
  const [viewTab, setViewTab] = useState<"scorecard" | "conversation">("scorecard");
  const result = record.result!;
  const tabStyle = (active: boolean) => ({
    fontFamily: F, fontSize: 12, fontWeight: 700 as const, border: "none" as const, cursor: "pointer" as const,
    padding: "8px 16px", borderRadius: 6, textTransform: "uppercase" as const,
    background: active ? P.accent + "20" : "transparent",
    color: active ? P.accent : P.textDim,
    borderBottom: active ? `2px solid ${P.accent}` : "2px solid transparent",
  });
  return (
    <div>
      <button onClick={onBack} style={{
        fontFamily: F, fontSize: 12, fontWeight: 600, color: P.accent,
        background: "transparent", border: "none", cursor: "pointer",
        padding: "8px 0", marginBottom: 16, display: "flex", alignItems: "center", gap: 6,
      }}>← Back to all calls</button>
      <div style={{
        display: "grid", gridTemplateColumns: "160px 1fr", gap: 24,
        padding: 24, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, marginBottom: 20,
      }}>
        <ScoreGauge score={result.totalScore} total={scorecard.totalPossible} passed={result.passed} hasCriticalFail={result.hasCriticalFail} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: P.text, marginBottom: 4 }}>{record.transcript.label}</div>
          <div style={{ fontSize: 12, color: P.textDim, lineHeight: 1.7, marginBottom: 16 }}>{result.summary}</div>
          {result.hasCriticalFail && (
            <div style={{ padding: "10px 14px", background: P.danger + "15", border: `1px solid ${P.danger}40`, borderRadius: 6, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.danger, marginBottom: 6, textTransform: "uppercase" }}>⚠ Critical Failures</div>
              {result.criticalFails.filter((cf) => cf.triggered).map((cf, i) => (
                <div key={i} style={{ fontSize: 11, color: P.text, marginBottom: 4, lineHeight: 1.5 }}>
                  • {cf.condition} — <span style={{ color: P.danger }}>{cf.evidence}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.accent, marginBottom: 6, textTransform: "uppercase" }}>Strengths</div>
              {result.strengths?.map((s, i) => <div key={i} style={{ fontSize: 11, color: P.textDim, marginBottom: 3, lineHeight: 1.5 }}>✓ {s}</div>)}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.warn, marginBottom: 6, textTransform: "uppercase" }}>Opportunities</div>
              {result.opportunities?.map((o, i) => <div key={i} style={{ fontSize: 11, color: P.textDim, marginBottom: 3, lineHeight: 1.5 }}>→ {o}</div>)}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${P.border}` }}>
        <button onClick={() => setViewTab("scorecard")} style={tabStyle(viewTab === "scorecard")}>📋 Scorecard</button>
        <button onClick={() => setViewTab("conversation")} style={tabStyle(viewTab === "conversation")}>💬 Conversation</button>
      </div>
      {viewTab === "scorecard" && scorecard.sections.map((section) => (
        <SectionResults key={section.name} section={section} scores={result.scores} />
      ))}
      {viewTab === "conversation" && (
        <ConversationView transcript={record.transcript} onBack={() => setViewTab("scorecard")} />
      )}
    </div>
  );
}

function SingleViewTabs({ transcript, scorecard, result }: {
  transcript: ParsedTranscript; scorecard: Scorecard; result: ScoringResult;
}) {
  const [viewTab, setViewTab] = useState<"scorecard" | "conversation">("scorecard");
  const tabStyle = (active: boolean) => ({
    fontFamily: F, fontSize: 12, fontWeight: 700 as const, border: "none" as const, cursor: "pointer" as const,
    padding: "8px 16px", borderRadius: 6, textTransform: "uppercase" as const,
    background: active ? P.accent + "20" : "transparent",
    color: active ? P.accent : P.textDim,
    borderBottom: active ? `2px solid ${P.accent}` : "2px solid transparent",
  });
  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${P.border}` }}>
        <button onClick={() => setViewTab("scorecard")} style={tabStyle(viewTab === "scorecard")}>📋 Detailed Scoring</button>
        <button onClick={() => setViewTab("conversation")} style={tabStyle(viewTab === "conversation")}>💬 Conversation</button>
      </div>
      {viewTab === "scorecard" && scorecard.sections.map((section) => (
        <SectionResults key={section.name} section={section} scores={result.scores} />
      ))}
      {viewTab === "conversation" && (
        <ConversationView transcript={transcript} onBack={() => setViewTab("scorecard")} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<"score" | "settings" | "samples">("score");
  const [scorecard, setScorecard] = useState<Scorecard>(DEFAULT_SCORECARD);
  const [scorecardSource, setScorecardSource] = useState("default");
  const [transcript, setTranscript] = useState("");
  const [singleResult, setSingleResult] = useState<ScoringResult | null>(null);
  const [batchRecords, setBatchRecords] = useState<BatchRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<number | null>(null);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scFileRef = useRef<HTMLInputElement>(null);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [dragT, setDragT] = useState(false);
  const [dragS, setDragS] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? sessionStorage.getItem("qa_auth") : null;
      if (stored === "true") { setAuthenticated(true); setAuthChecked(true); return; }
    } catch (_e) { /* */ }
    fetch("/api/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "__check_if_required__" }),
    }).then((r) => {
      if (r.ok) { setAuthenticated(true); try { sessionStorage.setItem("qa_auth", "true"); } catch (_e) { /* */ } }
      setAuthChecked(true);
    }).catch((_err) => setAuthChecked(true));
  }, []);

  const handleLogin = async () => {
    setAuthLoading(true); setAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: authPassword }),
      });
      if (res.ok) { setAuthenticated(true); try { sessionStorage.setItem("qa_auth", "true"); } catch (_e) { /* */ } }
      else { setAuthError("Incorrect password"); }
    } catch (_err) { setAuthError("Connection error"); }
    finally { setAuthLoading(false); }
  };

  const loadingMsgs = ["Parsing transcript...", "Evaluating compliance...", "Checking critical fails...", "Scoring against rubric...", "Compiling results..."];

  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setLoadingIdx((p) => (p + 1) % loadingMsgs.length), 2200);
    return () => clearInterval(iv);
  }, [loading, loadingMsgs.length]);

  const scoreOne = useCallback(async (text: string): Promise<ScoringResult> => {
    const res = await fetch("/api/score", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: text, scorecard }),
    });
    if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `Server error ${res.status}`); }
    return res.json();
  }, [scorecard]);

  const handleScoreSingle = useCallback(async () => {
    if (!transcript.trim()) { setError("Please paste or upload a transcript first."); return; }
    setError(null); setLoading(true); setLoadingIdx(0); setSingleResult(null);
    try { setSingleResult(await scoreOne(transcript)); }
    catch (err: unknown) { setError("Scoring failed: " + (err instanceof Error ? err.message : String(err))); }
    finally { setLoading(false); }
  }, [transcript, scoreOne]);

  const handleScoreBatch = useCallback(async () => {
    if (batchRecords.length === 0) return;
    setError(null); setLoading(true); setSelectedRecord(null);
    setBatchProgress({ done: 0, total: batchRecords.length });
    const updated = [...batchRecords];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: "scoring" };
      setBatchRecords([...updated]);
      try { const result = await scoreOne(updated[i].transcript.rawText); updated[i] = { ...updated[i], status: "done", result }; }
      catch (err: unknown) { updated[i] = { ...updated[i], status: "error", error: err instanceof Error ? err.message : String(err) }; }
      setBatchProgress({ done: i + 1, total: updated.length });
      setBatchRecords([...updated]);
    }
    setLoading(false);
  }, [batchRecords, scoreOne]);

  const readFile = (file: File): Promise<string> =>
    new Promise((res, rej) => { const r = new FileReader(); r.onload = (e) => res(e.target?.result as string); r.onerror = rej; r.readAsText(file); });

  const onTranscriptFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "csv", "text", "tsv"].includes(ext || "")) { setError("Please use a .txt, .csv, or .tsv file."); return; }
    setError(null);
    const text = await readFile(file);
    const parsed = parseTranscriptFile(text, file.name);
    if (parsed.length > 1) {
      setMode("batch");
      setBatchRecords(parsed.map((t) => ({ transcript: t, result: null, status: "pending" as const })));
      setSelectedRecord(null); setSingleResult(null);
    } else {
      setMode("single"); setTranscript(parsed[0].rawText);
      setBatchRecords([{ transcript: parsed[0], result: null, status: "pending" }]);
      setSingleResult(null);
    }
  };

  const onScorecardFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "csv", "text"].includes(ext || "")) { setError("Please use a .txt or .csv scorecard file."); return; }
    const parsed = parseScorecardFromText(await readFile(file));
    if (parsed) { setScorecard(parsed); setScorecardSource(file.name); setError(null); }
    else { setError("Could not parse scorecard. Use CSV: Section, Item, Criteria, Points"); }
  };

  const prevent = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const btn: React.CSSProperties = {
    fontFamily: F, fontSize: 12, fontWeight: 700, border: "none",
    borderRadius: 6, cursor: "pointer", padding: "10px 20px", letterSpacing: 0.5,
  };

  if (!authChecked) {
    return (<div style={{ minHeight: "100vh", background: P.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 12, color: P.textMuted, fontFamily: F }}>Loading...</div></div>);
  }

  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", background: P.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F }}>
        <div style={{ width: 380, padding: 32, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: P.accent, marginBottom: 4, letterSpacing: -0.5 }}>▧ CALL QA SCORER</div>
          <div style={{ fontSize: 11, color: P.textMuted, marginBottom: 24 }}>Enter password to continue</div>
          <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="Password" autoFocus
            style={{ width: "100%", padding: "12px 14px", background: P.surfaceAlt, border: `1px solid ${authError ? P.danger : P.border}`, borderRadius: 6, color: P.text, fontFamily: F, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
          {authError && <div style={{ fontSize: 11, color: P.danger, marginBottom: 12 }}>{authError}</div>}
          <button onClick={handleLogin} disabled={authLoading || !authPassword} style={{
            width: "100%", padding: "12px", background: P.accent, color: P.bg, fontFamily: F, fontSize: 13, fontWeight: 700, border: "none", borderRadius: 6, cursor: "pointer", opacity: !authPassword ? 0.4 : 1,
          }}>{authLoading ? "Verifying..." : "Enter"}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.text, fontFamily: F }}>
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
            <button key={t} onClick={() => { setTab(t); setSelectedRecord(null); }} style={{
              ...btn, background: tab === t ? P.accent + "20" : "transparent",
              color: tab === t ? P.accent : P.textDim,
              border: tab === t ? `1px solid ${P.accent}40` : "1px solid transparent",
              padding: "8px 16px", textTransform: "uppercase",
            }}>{t === "score" ? "⬡ Score" : t === "settings" ? "⚙ Settings" : "◉ Samples"}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "24px 20px" }}>
        {tab === "score" && (
          <div>
            {selectedRecord !== null && batchRecords[selectedRecord]?.result ? (
              <RecordDetail record={batchRecords[selectedRecord]} scorecard={scorecard} onBack={() => setSelectedRecord(null)} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 4 }}>Call Transcripts</div>
                    <div style={{ fontSize: 11, color: P.textMuted }}>Paste a single transcript, or upload a file with one or multiple calls</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input ref={fileRef} type="file" accept=".txt,.csv,.text,.tsv" onChange={(e) => e.target.files?.[0] && onTranscriptFile(e.target.files[0])} style={{ display: "none" }} />
                    <button onClick={() => fileRef.current?.click()} style={{ ...btn, background: P.surfaceAlt, color: P.textDim, border: `1px solid ${P.border}`, padding: "8px 14px" }}>↑ Upload File</button>
                    <button onClick={() => { setTranscript(""); setSingleResult(null); setBatchRecords([]); setSelectedRecord(null); setMode("single"); setError(null); }}
                      style={{ ...btn, background: P.surfaceAlt, color: P.textDim, border: `1px solid ${P.border}`, padding: "8px 14px" }}>Clear</button>
                  </div>
                </div>

                {mode === "batch" && batchRecords.length > 0 && (
                  <div style={{ padding: "10px 16px", background: P.accent + "10", border: `1px solid ${P.accent}30`, borderRadius: 8, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: P.accent, fontWeight: 600 }}>📁 {batchRecords.length} transcripts detected — Batch Mode</div>
                    <button onClick={() => { setMode("single"); setBatchRecords([]); setTranscript(""); }}
                      style={{ ...btn, background: "transparent", color: P.textDim, padding: "4px 10px", fontSize: 10, border: `1px solid ${P.border}` }}>Switch to Single</button>
                  </div>
                )}

                {mode === "single" && (
                  <div
                    onDragOver={(e) => { prevent(e); setDragT(true); }} onDragEnter={(e) => { prevent(e); setDragT(true); }}
                    onDragLeave={(e) => { prevent(e); setDragT(false); }}
                    onDrop={(e) => { prevent(e); setDragT(false); e.dataTransfer.files?.[0] && onTranscriptFile(e.dataTransfer.files[0]); }}
                    style={{ position: "relative", borderRadius: 8, border: dragT ? `2px dashed ${P.accent}` : `1px solid ${P.border}`, background: dragT ? P.accent + "08" : "transparent", transition: "all 0.2s ease" }}>
                    {dragT && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: P.accent + "12", borderRadius: 8, zIndex: 10, pointerEvents: "none" }}>
                        <div style={{ padding: "12px 24px", background: P.surface, border: `1px solid ${P.accent}60`, borderRadius: 8, fontSize: 13, fontWeight: 700, color: P.accent, fontFamily: F }}>↓ Drop transcript file here</div>
                      </div>
                    )}
                    <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
                      placeholder="Paste your call transcript here, or drag & drop a .txt / .csv file..." rows={12}
                      style={{ width: "100%", background: P.surface, border: "none", borderRadius: 8, padding: 16, color: P.text, fontFamily: F, fontSize: 12, lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
                  </div>
                )}

                {mode === "batch" && batchRecords.length > 0 && (
                  <BatchTable records={batchRecords} onSelect={setSelectedRecord} scorecard={scorecard} />
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: P.textMuted }}>
                    Scoring against: <span style={{ color: P.accent, fontWeight: 600 }}>{scorecard.title}</span> ({scorecard.totalPossible} pts, pass: {scorecard.passingThreshold})
                  </div>
                  <button onClick={mode === "single" ? handleScoreSingle : handleScoreBatch}
                    disabled={loading || (mode === "single" && !transcript.trim()) || (mode === "batch" && batchRecords.length === 0)}
                    style={{ ...btn, background: loading ? P.accentDim : P.accent, color: P.bg, padding: "12px 32px", fontSize: 13, opacity: (mode === "single" && !transcript.trim()) || (mode === "batch" && batchRecords.length === 0) ? 0.4 : 1 }}>
                    {loading ? mode === "batch" ? `⟳ Scoring ${batchProgress.done}/${batchProgress.total}...` : "⟳ Scoring..." : mode === "batch" ? `▶ Score All (${batchRecords.length})` : "▶ Score Transcript"}
                  </button>
                </div>

                {loading && mode === "single" && (
                  <div style={{ marginTop: 20, padding: 20, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8, textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, border: `3px solid ${P.border}`, borderTopColor: P.accent, borderRadius: "50%", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
                    <div style={{ fontSize: 12, color: P.accent, fontWeight: 600 }}>{loadingMsgs[loadingIdx]}</div>
                  </div>
                )}

                {loading && mode === "batch" && (
                  <div style={{ marginTop: 20, padding: 16, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: P.accent, fontWeight: 600 }}>Scoring transcript {Math.min(batchProgress.done + 1, batchProgress.total)} of {batchProgress.total}...</span>
                      <span style={{ fontSize: 12, color: P.textDim }}>{Math.round((batchProgress.done / batchProgress.total) * 100)}%</span>
                    </div>
                    <div style={{ height: 6, background: P.border, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: P.accent, borderRadius: 3, width: `${(batchProgress.done / batchProgress.total) * 100}%`, transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                )}

                {error && <div style={{ marginTop: 16, padding: "12px 16px", background: P.dangerDim + "30", border: `1px solid ${P.danger}40`, borderRadius: 8, fontSize: 12, color: P.danger }}>{error}</div>}

                {mode === "single" && singleResult && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 24, padding: 24, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, marginBottom: 20 }}>
                      <ScoreGauge score={singleResult.totalScore} total={scorecard.totalPossible} passed={singleResult.passed} hasCriticalFail={singleResult.hasCriticalFail} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: P.text, marginBottom: 8 }}>Assessment Summary</div>
                        <div style={{ fontSize: 12, color: P.textDim, lineHeight: 1.7, marginBottom: 16 }}>{singleResult.summary}</div>
                        {singleResult.hasCriticalFail && (
                          <div style={{ padding: "10px 14px", background: P.danger + "15", border: `1px solid ${P.danger}40`, borderRadius: 6, marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: P.danger, marginBottom: 6, textTransform: "uppercase" }}>⚠ Critical Failures</div>
                            {singleResult.criticalFails.filter((cf) => cf.triggered).map((cf, i) => (
                              <div key={i} style={{ fontSize: 11, color: P.text, marginBottom: 4, lineHeight: 1.5 }}>• {cf.condition} — <span style={{ color: P.danger }}>{cf.evidence}</span></div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: P.accent, marginBottom: 6, textTransform: "uppercase" }}>Strengths</div>
                            {singleResult.strengths?.map((s, i) => <div key={i} style={{ fontSize: 11, color: P.textDim, marginBottom: 3, lineHeight: 1.5 }}>✓ {s}</div>)}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: P.warn, marginBottom: 6, textTransform: "uppercase" }}>Opportunities</div>
                            {singleResult.opportunities?.map((o, i) => <div key={i} style={{ fontSize: 11, color: P.textDim, marginBottom: 3, lineHeight: 1.5 }}>→ {o}</div>)}
                          </div>
                        </div>
                      </div>
                    </div>
                    {batchRecords.length === 1 && batchRecords[0].transcript.lines.length > 1
                      ? <SingleViewTabs transcript={batchRecords[0].transcript} scorecard={scorecard} result={singleResult} />
                      : <>{scorecard.sections.map((section) => <SectionResults key={section.name} section={section} scores={singleResult.scores} />)}</>
                    }
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: P.text, marginBottom: 4 }}>Scorecard Configuration</div>
            <div style={{ fontSize: 12, color: P.textDim, marginBottom: 20, lineHeight: 1.6 }}>Upload a custom scorecard or use the default. Accepted: .txt or .csv (Section, Item, Criteria, Points).</div>
            <div style={{ padding: 20, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div><div style={{ fontSize: 13, fontWeight: 700, color: P.text }}>Active Scorecard</div><div style={{ fontSize: 12, color: P.accent, marginTop: 2 }}>{scorecard.title}</div></div>
                <Badge color={scorecardSource === "default" ? P.accent : P.warn}>{scorecardSource === "default" ? "DEFAULT" : "CUSTOM"}</Badge>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[{ val: scorecard.totalPossible, label: "Total Points", color: P.accent }, { val: scorecard.passingThreshold, label: "Pass Threshold", color: P.warn }, { val: scorecard.sections.reduce((t, s) => t + s.items.length, 0), label: "Scoring Items", color: P.text }].map((m) => (
                  <div key={m.label} style={{ padding: 12, background: P.surfaceAlt, borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.val}</div>
                    <div style={{ fontSize: 10, color: P.textMuted, textTransform: "uppercase" }}>{m.label}</div>
                  </div>
                ))}
              </div>
              <div onDragOver={(e) => { prevent(e); setDragS(true); }} onDragEnter={(e) => { prevent(e); setDragS(true); }}
                onDragLeave={(e) => { prevent(e); setDragS(false); }}
                onDrop={(e) => { prevent(e); setDragS(false); e.dataTransfer.files?.[0] && onScorecardFile(e.dataTransfer.files[0]); }}
                style={{ padding: 16, borderRadius: 8, marginBottom: 12, border: dragS ? `2px dashed ${P.accent}` : `2px dashed ${P.border}`, background: dragS ? P.accent + "08" : P.surfaceAlt, textAlign: "center", transition: "all 0.2s ease" }}>
                {dragS ? <div style={{ fontSize: 13, fontWeight: 700, color: P.accent, padding: "8px 0" }}>↓ Drop scorecard file here</div>
                  : <div style={{ padding: "4px 0" }}><div style={{ fontSize: 12, color: P.textDim, marginBottom: 4 }}>Drag &amp; drop a scorecard file here</div><div style={{ fontSize: 10, color: P.textMuted }}>.txt or .csv</div></div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input ref={scFileRef} type="file" accept=".txt,.csv,.text" onChange={(e) => e.target.files?.[0] && onScorecardFile(e.target.files[0])} style={{ display: "none" }} />
                <button onClick={() => scFileRef.current?.click()} style={{ ...btn, background: P.accent, color: P.bg, flex: 1 }}>↑ Browse &amp; Upload</button>
                <button onClick={() => { setScorecard(DEFAULT_SCORECARD); setScorecardSource("default"); }} style={{ ...btn, background: P.surfaceAlt, color: P.textDim, border: `1px solid ${P.border}` }}>Reset to Default</button>
              </div>
            </div>
            <div style={{ padding: 20, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 16 }}>Current Scorecard Items</div>
              {scorecard.sections.map((section) => (
                <div key={section.name} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: P.accent, padding: "6px 12px", background: P.accent + "10", borderRadius: 4, marginBottom: 8 }}>{section.name} — {section.items.reduce((t, i) => t + i.points, 0)} pts</div>
                  {section.items.map((item) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 12px", fontSize: 11, borderBottom: `1px solid ${P.border}30` }}>
                      <div style={{ flex: 1, marginRight: 12 }}><span style={{ fontWeight: 600, color: P.text }}>{item.label}</span><span style={{ color: P.textMuted }}> — {item.criteria}</span></div>
                      <span style={{ fontWeight: 700, color: P.warn, whiteSpace: "nowrap" }}>{item.points} pts</span>
                    </div>
                  ))}
                </div>
              ))}
              {scorecard.criticalFails.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: P.danger, padding: "6px 12px", background: P.danger + "10", borderRadius: 4, marginBottom: 8 }}>Critical Fail Conditions</div>
                  {scorecard.criticalFails.map((cf, i) => <div key={i} style={{ padding: "4px 12px", fontSize: 11, color: P.textDim, lineHeight: 1.5 }}>⚠ {cf}</div>)}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "samples" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: P.text, marginBottom: 4 }}>Sample Transcripts</div>
            <div style={{ fontSize: 12, color: P.textDim, marginBottom: 20, lineHeight: 1.6 }}>Load pre-built samples to test the scoring engine.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { type: "good" as const, label: "✓ Compliant Call", badge: "HIGH SCORE", color: P.accent, text: "Agent follows proper identification, security verification, all compliance disclosures, and proper denial handling." },
                { type: "bad" as const, label: "✗ Non-Compliant Call", badge: "CRITICAL FAILS", color: P.danger, text: "Agent misidentifies company, skips verification, promises approval, guarantees timelines, coaches answers." },
              ].map((s) => (
                <div key={s.type} style={{ padding: 20, background: P.surface, border: `1px solid ${s.color}30`, borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</div><Badge color={s.color}>{s.badge}</Badge>
                  </div>
                  <div style={{ fontSize: 11, color: P.textDim, lineHeight: 1.6, marginBottom: 16, minHeight: 60 }}>{s.text}</div>
                  <button onClick={() => {
                    const raw = s.type === "good" ? GOOD_TRANSCRIPT : BAD_TRANSCRIPT;
                    const parsed = parseTranscriptFile(raw, "sample.txt");
                    setTranscript(raw); setBatchRecords(parsed.map((t) => ({ transcript: t, result: null, status: "pending" as const })));
                    setMode("single"); setSingleResult(null); setTab("score");
                  }} style={{ ...btn, background: s.color + "20", color: s.color, border: `1px solid ${s.color}40`, width: "100%" }}>
                    Load {s.type === "good" ? "Good" : "Bad"} Sample
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: 16, background: P.surfaceAlt, borderRadius: 8, border: `1px solid ${P.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.text, marginBottom: 8 }}>Upload Format Guide</div>
              <div style={{ fontSize: 11, color: P.textDim, lineHeight: 1.7 }}><strong style={{ color: P.text }}>Single transcript:</strong> Plain text with &quot;Agent:&quot; / &quot;Customer:&quot; labels, or CSV with speaker + text columns.</div>
              <div style={{ fontSize: 11, color: P.textDim, lineHeight: 1.7, marginTop: 8 }}><strong style={{ color: P.text }}>Multiple transcripts:</strong> CSV with a Call ID column — each unique ID becomes a separate call. Columns auto-detected.</div>
              <div style={{ fontSize: 11, color: P.textDim, lineHeight: 1.7, marginTop: 8 }}><strong style={{ color: P.text }}>Scorecard files:</strong> CSV with columns: Section, Item, Criteria, Points.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
