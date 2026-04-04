// ── Smart transcript parser ─────────────────────────────────────────────
// Handles: plain text, CSV with single or multiple transcripts,
// auto-detects speaker/dialogue columns, groups by call ID

export interface ParsedTranscript {
  id: string;
  label: string; // display name (e.g. "Call #1 — Agent: Maria")
  agentName: string;
  customerName: string;
  lines: { speaker: string; role: "agent" | "customer"; text: string }[];
  rawText: string;
}

// Common column name patterns
const CALL_ID_PATTERNS = /^(call.?id|id|call.?number|interaction.?id|session.?id|record.?id|case.?id)$/i;
const SPEAKER_PATTERNS = /^(speaker|role|participant|from|name|agent.?customer|type|who)$/i;
const TEXT_PATTERNS = /^(text|message|content|dialogue|transcript|utterance|body|comment|response|speech|conversation)$/i;
const AGENT_PATTERNS = /^(agent|rep|representative|advisor|consultant|associate|employee|staff|counselor)$/i;
const TIMESTAMP_PATTERNS = /^(time|timestamp|date|start|end|duration|created)$/i;
const AGENT_NAME_PATTERNS = /^(agent.?name|rep.?name|employee.?name|agent|representative)$/i;

function detectCSVDelimiter(text: string): string {
  const firstLine = text.split("\n")[0];
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  const pipes = (firstLine.match(/\|/g) || []).length;
  if (tabs >= commas && tabs >= pipes) return "\t";
  if (pipes >= commas && pipes >= tabs) return "|";
  return ",";
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function isHeaderRow(cells: string[]): boolean {
  // If most cells are short non-numeric strings, likely a header
  const nonNumeric = cells.filter((c) => c && isNaN(Number(c)) && c.length < 60);
  return nonNumeric.length >= cells.length * 0.6;
}

interface ColumnMap {
  callId: number;
  speaker: number;
  text: number;
  agentName: number;
  timestamp: number;
}

function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = { callId: -1, speaker: -1, text: -1, agentName: -1, timestamp: -1 };
  headers.forEach((h, i) => {
    const clean = h.replace(/['"]/g, "").trim();
    if (CALL_ID_PATTERNS.test(clean)) map.callId = i;
    else if (SPEAKER_PATTERNS.test(clean)) map.speaker = i;
    else if (TEXT_PATTERNS.test(clean)) map.text = i;
    else if (AGENT_NAME_PATTERNS.test(clean) && map.speaker !== i) map.agentName = i;
    else if (TIMESTAMP_PATTERNS.test(clean)) map.timestamp = i;
  });
  // If no text column found, pick the longest-content column heuristic
  // will be resolved in parseCSV when we have data
  return map;
}

function classifySpeaker(speaker: string): "agent" | "customer" {
  const s = speaker.toLowerCase().trim();
  if (AGENT_PATTERNS.test(s)) return "agent";
  if (/^(customer|client|consumer|caller|borrower|member|user|debtor)$/i.test(s)) return "customer";
  // Default: first unique speaker is agent, second is customer
  return "customer";
}

// ── Parse plain text transcript ─────────────────────────────────────────

function parsePlainText(text: string): ParsedTranscript[] {
  const lines: { speaker: string; role: "agent" | "customer"; text: string }[] = [];
  const speakerSet = new Set<string>();

  // Try to detect "Speaker: text" pattern
  const linePattern = /^([A-Za-z\s.]+?):\s*(.+)/;
  const rawLines = text.split("\n").filter((l) => l.trim());

  let hasPatternMatch = false;
  for (const line of rawLines) {
    const match = line.match(linePattern);
    if (match) {
      hasPatternMatch = true;
      const speaker = match[1].trim();
      speakerSet.add(speaker);
      lines.push({ speaker, role: "customer", text: match[2].trim() });
    } else if (lines.length > 0) {
      // Continuation of previous line
      lines[lines.length - 1].text += " " + line.trim();
    }
  }

  if (!hasPatternMatch) {
    // No speaker pattern — treat entire thing as one blob
    return [{
      id: "single",
      label: "Uploaded Transcript",
      agentName: "Unknown Agent",
      customerName: "Unknown Customer",
      lines: [{ speaker: "Transcript", role: "agent", text }],
      rawText: text,
    }];
  }

  // Classify speakers: first speaker is typically agent
  const speakers = Array.from(speakerSet);
  const speakerRoles: Record<string, "agent" | "customer"> = {};

  if (speakers.length === 2) {
    // Heuristic: check common patterns first
    for (const s of speakers) {
      if (AGENT_PATTERNS.test(s.toLowerCase()) || s.toLowerCase().includes("agent")) {
        speakerRoles[s] = "agent";
      } else if (/customer|client|consumer/i.test(s.toLowerCase())) {
        speakerRoles[s] = "customer";
      }
    }
    // If not classified, first speaker = agent
    if (!speakerRoles[speakers[0]]) speakerRoles[speakers[0]] = speakerRoles[speakers[1]] === "agent" ? "customer" : "agent";
    if (!speakerRoles[speakers[1]]) speakerRoles[speakers[1]] = speakerRoles[speakers[0]] === "agent" ? "customer" : "agent";
  } else {
    speakers.forEach((s, i) => {
      speakerRoles[s] = i === 0 ? "agent" : "customer";
    });
  }

  lines.forEach((l) => { l.role = speakerRoles[l.speaker] || "customer"; });

  const agentName = speakers.find((s) => speakerRoles[s] === "agent") || "Agent";
  const customerName = speakers.find((s) => speakerRoles[s] === "customer") || "Customer";

  return [{
    id: "single",
    label: `Call — ${agentName}`,
    agentName,
    customerName,
    lines,
    rawText: text,
  }];
}

// ── Parse CSV transcript(s) ─────────────────────────────────────────────

function parseCSV(text: string): ParsedTranscript[] {
  const delimiter = detectCSVDelimiter(text);
  const rawLines = text.split("\n").filter((l) => l.trim());
  if (rawLines.length < 2) return parsePlainText(text);

  const headerCells = parseCSVLine(rawLines[0], delimiter);
  if (!isHeaderRow(headerCells)) {
    // No header detected — treat as plain text
    return parsePlainText(text);
  }

  const colMap = detectColumns(headerCells);

  // If we couldn't find a text column, pick the one with longest avg content
  if (colMap.text === -1) {
    const avgLens = headerCells.map((_, ci) => {
      const sample = rawLines.slice(1, Math.min(6, rawLines.length));
      const total = sample.reduce((s, line) => {
        const cells = parseCSVLine(line, delimiter);
        return s + (cells[ci]?.length || 0);
      }, 0);
      return total / sample.length;
    });
    // Exclude already-mapped columns
    const candidates = avgLens.map((len, i) =>
      i === colMap.callId || i === colMap.speaker || i === colMap.timestamp ? 0 : len
    );
    colMap.text = candidates.indexOf(Math.max(...candidates));
  }

  // If no speaker column, try to detect from text patterns
  const hasSpeakerCol = colMap.speaker !== -1;

  // Parse all data rows
  interface DataRow {
    callId: string;
    speaker: string;
    text: string;
    agentName: string;
  }

  const rows: DataRow[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const cells = parseCSVLine(rawLines[i], delimiter);
    if (cells.length <= 1 && !cells[0]?.trim()) continue;

    const callId = colMap.callId !== -1 ? (cells[colMap.callId] || "1") : "1";
    let speaker = hasSpeakerCol ? (cells[colMap.speaker] || "Unknown") : "Unknown";
    const textContent = cells[colMap.text] || cells.join(" ");
    const agentName = colMap.agentName !== -1 ? (cells[colMap.agentName] || "") : "";

    // If no speaker column, try to detect from text
    if (!hasSpeakerCol) {
      const match = textContent.match(/^([A-Za-z\s.]+?):\s*/);
      if (match) { speaker = match[1].trim(); }
    }

    if (textContent.trim()) {
      rows.push({ callId: callId.trim(), speaker: speaker.trim(), text: textContent.trim(), agentName: agentName.trim() });
    }
  }

  if (rows.length === 0) return parsePlainText(text);

  // Group by call ID
  const groups = new Map<string, DataRow[]>();
  rows.forEach((r) => {
    const existing = groups.get(r.callId) || [];
    existing.push(r);
    groups.set(r.callId, existing);
  });

  const transcripts: ParsedTranscript[] = [];
  let idx = 0;

  groups.forEach((groupRows, callId) => {
    idx++;
    const speakers = Array.from(new Set(groupRows.map((r) => r.speaker)));
    const speakerRoles: Record<string, "agent" | "customer"> = {};

    // Classify speakers
    for (const s of speakers) {
      const role = classifySpeaker(s);
      speakerRoles[s] = role;
    }

    // If all classified the same, fix: first = agent, rest = customer
    const roles = Object.values(speakerRoles);
    if (roles.every((r) => r === "agent") || roles.every((r) => r === "customer")) {
      speakers.forEach((s, i) => { speakerRoles[s] = i === 0 ? "agent" : "customer"; });
    }

    const lines = groupRows.map((r) => ({
      speaker: r.speaker,
      role: speakerRoles[r.speaker] || "customer" as const,
      text: r.text.replace(/^[A-Za-z\s.]+?:\s*/, ""), // strip speaker prefix if embedded in text
    }));

    const agentSpeaker = speakers.find((s) => speakerRoles[s] === "agent") || speakers[0] || "Agent";
    const customerSpeaker = speakers.find((s) => speakerRoles[s] === "customer") || speakers[1] || "Customer";
    const agentName = groupRows.find((r) => r.agentName)?.agentName || agentSpeaker;

    const rawText = lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");

    transcripts.push({
      id: groups.size > 1 ? callId : `call_${idx}`,
      label: groups.size > 1
        ? `Call #${idx} (ID: ${callId}) — ${agentName}`
        : `Call — ${agentName}`,
      agentName,
      customerName: customerSpeaker,
      lines,
      rawText,
    });
  });

  return transcripts;
}

// ── Main parse function ─────────────────────────────────────────────────

export function parseTranscriptFile(text: string, filename: string): ParsedTranscript[] {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (ext === "csv" || ext === "tsv") {
    return parseCSV(text);
  }

  // For .txt and other text files
  // Check if it looks like CSV (has consistent delimiters)
  const firstLines = text.split("\n").slice(0, 3);
  const commaCount = firstLines.map((l) => (l.match(/,/g) || []).length);
  if (commaCount[0] > 2 && commaCount.every((c) => Math.abs(c - commaCount[0]) <= 1)) {
    return parseCSV(text);
  }

  return parsePlainText(text);
}
