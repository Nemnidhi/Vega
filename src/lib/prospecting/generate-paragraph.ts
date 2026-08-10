// Generates the report's 2-3 sentence "what this means" paragraph.
// Groq (Llama 3.3 70B) is primary, Gemini is the fallback if Groq fails or
// isn't configured, and a plain-template sentence is the last-resort
// fallback so report generation never hard-fails on an LLM outage.
//
// In practice Groq has never been configured (no key), so Gemini does the
// work and the Groq call exists as a cheap first attempt.

import { getIndustryLabel, getSegmentLabel } from "@/lib/prospecting/industry-knowledge";
import type { ClassificationResult, EnrichmentSignals, ProspectSubject } from "@/lib/prospecting/types";

/**
 * Describes the recipient for the prompt, from the knowledge bank.
 *
 * This used to be hardcoded to "a real-estate agent/firm", which was right
 * when the engine only handled real estate and wrong for the other 19
 * industries. Falls back to a neutral description rather than guessing -
 * telling the model the wrong sector is worse than telling it nothing.
 */
export function describeRecipient(lead: ProspectSubject): string {
  const industry = getIndustryLabel(lead.industry);
  if (!industry) return "a small or mid-sized business";

  const segment = getSegmentLabel(lead.industry, {
    segment: lead.segment,
    text: lead.businessCategory || lead.entityType || lead.name,
  });

  return segment
    ? `a business in the ${industry} sector - specifically ${segment}`
    : `a business in the ${industry} sector`;
}

function buildSystemPrompt(lead: ProspectSubject) {
  return `You write a short paragraph for a business-development report sent directly to ${describeRecipient(lead)} about their online presence.

Rules:
- Write exactly 2-3 sentences.
- Address the business in second person ("you"/"your business") throughout - never switch to third person or use the business's own name as the sentence subject.
- Use ONLY the facts provided below. Never invent specific numbers, ratings, review counts, ad counts, or other statistics that were not given to you.
- If a channel is marked "not checked", do not claim or imply it was checked or that it is missing - simply don't mention it.
- Tone: professional, direct, and helpful - like a knowledgeable colleague pointing out an opportunity, not a sales pitch full of hype.
- Do not use exclamation points or superlatives ("amazing", "huge", "incredible").
- Do not name the sector back to the reader unless it is relevant to the point you are making; they know what business they are in.`;
}

export type ParagraphSource = "groq" | "gemini" | "fallback_template";

export interface ParagraphResult {
  text: string;
  source: ParagraphSource;
  groqError?: string;
  geminiError?: string;
}

export function buildFactsSummary(
  lead: ProspectSubject,
  enrichment: EnrichmentSignals,
  classification: ClassificationResult,
) {
  const lines = [
    `Business name: ${lead.name}`,
    `Type: ${lead.entityType ?? "Not specified"}`,
    `Location: ${[lead.district, lead.state].filter(Boolean).join(", ")}`,
  ];

  if (enrichment.website?.found) {
    lines.push(`Website: found at ${enrichment.website.url}`);
  } else {
    lines.push("Website: no website found under a plausible domain guess");
  }

  if (enrichment.googleBusiness?.checked) {
    lines.push(`Google Business profile: ${enrichment.googleBusiness.found ? "found" : "not found"}`);
  }

  if (enrichment.metaAds?.checked) {
    lines.push(`Meta ad activity: ${enrichment.metaAds.found ? "found" : "not found"}`);
  }

  lines.push(`Overall classification tier: ${classification.category} (${classification.reasoning})`);

  return lines.join("\n");
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
        { role: "user", content: `Facts:\n${facts}\n\nWrite the paragraph.` },
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
        contents: [{ parts: [{ text: `Facts:\n${facts}\n\nWrite the paragraph.` }] }],
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

function fallbackParagraph(
  lead: ProspectSubject,
  enrichment: EnrichmentSignals,
  classification: ClassificationResult,
) {
  const hasWebsite = Boolean(enrichment.website?.found);
  return (
    `${lead.name} was reviewed as part of a digital presence check. ` +
    `${hasWebsite ? "A website was found for the business." : "No website was found for the business under a plausible domain guess."} ` +
    `Based on the channels checked so far, this business falls into tier ${classification.category} of our review.`
  );
}

export async function generateParagraph(
  lead: ProspectSubject,
  enrichment: EnrichmentSignals,
  classification: ClassificationResult,
): Promise<ParagraphResult> {
  const facts = buildFactsSummary(lead, enrichment, classification);
  const systemPrompt = buildSystemPrompt(lead);

  try {
    return { text: await callGroq(facts, systemPrompt), source: "groq" };
  } catch (groqErr) {
    try {
      return { text: await callGemini(facts, systemPrompt), source: "gemini", groqError: String(groqErr) };
    } catch (geminiErr) {
      return {
        text: fallbackParagraph(lead, enrichment, classification),
        source: "fallback_template",
        groqError: String(groqErr),
        geminiError: String(geminiErr),
      };
    }
  }
}
