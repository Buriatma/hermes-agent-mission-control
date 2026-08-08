import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const row = await prisma.dataStore.findUnique({ where: { key: "hermes-briefing" } });
  if (!row?.data) return NextResponse.json({ generatedAt: null, summary: null, sections: [] });

  const raw = row.data as Record<string, unknown>;

  // Decode: summary might be a JSON string like '{"greeting":"...","summary":"...","sections":[...]}'
  let summary: unknown = raw.summary ?? null;
  let sections: unknown = raw.sections ?? [];
  let greeting: unknown = raw.greeting ?? null;
  let generatedAt: unknown = raw.generatedAt ?? null;

  if (typeof summary === "string") {
    const s = summary.trim();
    if (s.startsWith("{") || s.startsWith("```")) {
      try {
        const cleaned = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
        const parsed = JSON.parse(cleaned);
        summary = parsed.summary ?? parsed.greeting ?? summary;
        sections = parsed.sections ?? sections;
        greeting = parsed.greeting ?? greeting;
        generatedAt = parsed.generatedAt ?? generatedAt;
      } catch { /* keep raw */ }
    }
  }

  return NextResponse.json({ generatedAt, greeting, summary, sections });
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
