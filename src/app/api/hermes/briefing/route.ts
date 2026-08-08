import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * The bridge stores the briefing as JSON under DataStore["hermes-briefing"].
 * Sometimes `summary` contains a raw ```json block (model returned a JSON
 * string with an invalid comma, so bridge JSON.parse failed and it stored
 * the raw text). This decodes every shape we've seen into clean fields:
 *  - { summary: "..." }                        (already clean)
 *  - { summary: "```json {...}```" }           (fenced JSON)
 *  - { summary: "`{\"greeting\":..}" }          (JSON text with regex extraction fallback)
 */
function decodeBriefing(raw: Record<string, unknown>) {
  let generatedAt = (raw as any).generatedAt ?? null;
  let greeting = (raw as any).greeting ?? null;
  let summary = (raw as any).summary ?? null;
  let sections = Array.isArray((raw as any).sections) ? (raw as any).sections : [];

  // If summary is a string, try to interpret it as JSON payload
  if (typeof summary === "string") {
    let s = summary.trim();
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/g, "").trim();

    let parsed: any = null;
    try { parsed = JSON.parse(s); } catch { /* fall through to regex */ }

    // Some outputs look like an object but fail JSON.parse (missing comma etc).
    // Fall back to regex extraction so we still get the readable bits.
    if (!parsed && /"summary"\s*:/.test(s)) {
      const extract = (key: string) => {
        const m = s.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
        return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : null;
      };
      const secMatch = s.match(/"sections"\s*:\s*(\[[\s\S]*?\])/);
      let secs: any[] | null = null;
      if (secMatch) { try { secs = JSON.parse(secMatch[1].replace(/\\"/g, '"')); } catch { secs = null; } }
      parsed = {
        summary: extract("summary"),
        greeting: extract("greeting") || greeting,
        sections: secs || [],
        generatedAt: extract("generatedAt") || generatedAt,
      };
    }

    if (parsed && typeof parsed === "object") {
      summary = parsed.summary ?? parsed.greeting ?? summary;
      sections = Array.isArray(parsed.sections) ? parsed.sections : sections;
      greeting = parsed.greeting ?? greeting;
      generatedAt = parsed.generatedAt ?? generatedAt;
    }
  }

  // Strip any remaining markdown fences or JSON braces from the summary text
  let finalSummary: any = summary;
  if (typeof summary === "string") {
    let t = summary.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/g, "").trim();
    if (t.startsWith("{")) { try { const o = JSON.parse(t); finalSummary = o.summary ?? o.greeting ?? t; } catch { finalSummary = t; } }
    else finalSummary = t;
  }

  return { generatedAt, greeting, summary: finalSummary, sections };
}

export async function GET() {
  const row = await prisma.dataStore.findUnique({ where: { key: "hermes-briefing" } });
  if (!row?.data) return NextResponse.json({ generatedAt: null, summary: null, sections: [] });
  return NextResponse.json(decodeBriefing(row.data as Record<string, unknown>));
}

// POST → ask the bridge to (re)generate the chief-of-staff brief now.
export async function POST() {
  const row = await prisma.agentRequest.create({
    data: {
      origin: "web",
      kind: "briefing.generate",
      title: "Generate chief-of-staff brief",
      prompt: "now",
      sideEffecting: false,
      status: "queued",
    },
  });
  return NextResponse.json({ request: row });
}