import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { transcript, scorecard } = await request.json();

    if (!transcript || !scorecard) {
      return NextResponse.json(
        { error: "Missing transcript or scorecard" },
        { status: 400 }
      );
    }

    const itemsFlat = scorecard.sections.flatMap(
      (s: { name: string; items: { id: string; label: string; points: number; criteria: string }[] }) =>
        s.items.map((i) => ({
          id: i.id,
          section: s.name,
          label: i.label,
          points: i.points,
          criteria: i.criteria,
        }))
    );

    const systemPrompt = `You are a call quality assurance analyst. You will evaluate a call transcript against a QA scorecard.

SCORECARD: "${scorecard.title}"
Passing threshold: ${scorecard.passingThreshold}/${scorecard.totalPossible}
Script adherence note: ${scorecard.scriptAdherence}

SCORING ITEMS:
${itemsFlat.map((i: { id: string; section: string; label: string; points: number; criteria: string }) => `- [${i.id}] ${i.section} > ${i.label} (${i.points} pts): ${i.criteria}`).join("\n")}

CRITICAL FAIL CONDITIONS (any one = automatic 0 score):
${scorecard.criticalFails.map((cf: string, idx: number) => `${idx + 1}. ${cf}`).join("\n")}

RUBRIC:
- Full points: Meets criteria clearly, timely, and per script language
- Partial points: Meets intent but language or sequencing deviates without impacting compliance
- Zero points: Misses requirement, provides inaccurate info, or deviates materially

INSTRUCTIONS:
1. Read the transcript carefully
2. For each scoring item, determine the score (0, partial, or full)
3. Check all critical fail conditions
4. Provide your response as ONLY valid JSON, no markdown, no backticks. Use this exact structure:

{
  "scores": [
    {"id": "item_id", "awarded": number, "maxPoints": number, "result": "Y" | "N" | "Partial" | "N/A", "reasoning": "brief explanation"}
  ],
  "criticalFails": [
    {"condition": "description", "triggered": true/false, "evidence": "brief explanation"}
  ],
  "totalScore": number,
  "passed": boolean,
  "hasCriticalFail": boolean,
  "strengths": ["strength1", "strength2"],
  "opportunities": ["opportunity1", "opportunity2"],
  "summary": "2-3 sentence overall assessment"
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please evaluate this call transcript:\n\n${transcript}`,
        },
      ],
    });

    const text = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Scoring error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Scoring failed: ${msg}` }, { status: 500 });
  }
}
