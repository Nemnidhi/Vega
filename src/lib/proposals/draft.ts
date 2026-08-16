// AI drafting assist for the proposal generator - same resilience pattern as
// lib/prospecting/generate-paragraph.ts (Groq primary, Gemini fallback, a plain-template
// fallback so drafting never hard-fails), applied to proposal narrative text instead of audit
// report paragraphs. Only drafts the two genuinely-prose fields (projectSummary, timeline) -
// exclusions/changeOrderClause are structured/already-prose data on ScopeManifest, so the API
// route that calls this copies those directly rather than asking AI to rewrite them.

export interface ProposalDraftInput {
  clientName: string;
  leadTitle: string;
  businessObjective: string;
  confirmedDeliverables: string[];
  timelineAssumptions: string[];
}

export type ProposalDraftSource = "groq" | "gemini" | "fallback_template";

export interface ProposalDraftResult {
  projectSummary: string;
  timeline: string;
  source: ProposalDraftSource;
  groqError?: string;
  geminiError?: string;
}

function buildSystemPrompt() {
  return `You write two short sections of a client-facing project proposal for a software/creative agency.

Rules:
- Use ONLY the facts provided below. Never invent deliverables, dates, durations, or details not given to you.
- Tone: professional, confident, and clear - written for a business client reading their own proposal, not internal notes.
- Do not use exclamation points or superlatives ("amazing", "huge", "incredible").
- Output EXACTLY this format, nothing else, no markdown:
PROJECT SUMMARY:
<2-4 sentence paragraph summarizing the project and its objective>
TIMELINE:
<1-2 sentence paragraph describing the project timeline in prose, based on the assumptions given>`;
}

function buildFactsSummary(input: ProposalDraftInput) {
  const lines = [
    `Client: ${input.clientName}`,
    `Project: ${input.leadTitle}`,
    `Business objective: ${input.businessObjective}`,
    `Confirmed deliverables: ${input.confirmedDeliverables.join("; ")}`,
  ];
  if (input.timelineAssumptions.length > 0) {
    lines.push(`Timeline assumptions: ${input.timelineAssumptions.join("; ")}`);
  }
  return lines.join("\n");
}

function parseSections(text: string): { projectSummary: string; timeline: string } | null {
  const match = text.match(/PROJECT SUMMARY:\s*([\s\S]*?)\s*TIMELINE:\s*([\s\S]*)/i);
  if (!match) return null;
  const projectSummary = match[1].trim();
  const timeline = match[2].trim();
  if (!projectSummary || !timeline) return null;
  return { projectSummary, timeline };
}

async function callGroq(facts: string, systemPrompt: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Facts:\n${facts}\n\nWrite the two sections.` },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq API returned no content");
  return text as string;
}

async function callGemini(facts: string, systemPrompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: `Facts:\n${facts}\n\nWrite the two sections.` }] }],
        generationConfig: { temperature: 0.4 },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini API returned no content");
  return text as string;
}

function fallbackDraft(input: ProposalDraftInput): { projectSummary: string; timeline: string } {
  const deliverables = input.confirmedDeliverables.join(", ");
  return {
    projectSummary: `This proposal covers ${input.leadTitle} for ${input.clientName}. ${input.businessObjective} Confirmed deliverables include: ${deliverables}.`,
    timeline:
      input.timelineAssumptions.length > 0
        ? input.timelineAssumptions.join(" ")
        : "Timeline to be confirmed based on final scope.",
  };
}

export async function draftProposalSummary(input: ProposalDraftInput): Promise<ProposalDraftResult> {
  const facts = buildFactsSummary(input);
  const systemPrompt = buildSystemPrompt();

  try {
    const raw = await callGroq(facts, systemPrompt);
    const parsed = parseSections(raw);
    if (!parsed) throw new Error("Could not parse Groq response into sections");
    return { ...parsed, source: "groq" };
  } catch (groqErr) {
    try {
      const raw = await callGemini(facts, systemPrompt);
      const parsed = parseSections(raw);
      if (!parsed) throw new Error("Could not parse Gemini response into sections");
      return { ...parsed, source: "gemini", groqError: String(groqErr) };
    } catch (geminiErr) {
      return {
        ...fallbackDraft(input),
        source: "fallback_template",
        groqError: String(groqErr),
        geminiError: String(geminiErr),
      };
    }
  }
}
