import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  const bySource = await prisma.hermesSession.groupBy({
    by: ["source"],
    _count: true,
    _sum: { input_tokens: true, output_tokens: true, cache_read_tokens: true, cache_write_tokens: true, estimated_cost_usd: true, actual_cost_usd: true },
  });
  const topSessions = await prisma.hermesSession.findMany({
    orderBy: [{ input_tokens: "desc" }],
    take: 10,
    select: { id: true, source: true, model: true, input_tokens: true, output_tokens: true, estimated_cost_usd: true, actual_cost_usd: true, started_at: true, title: true },
  });
  const d = await prisma.hermesSession.findMany({
    orderBy: { started_at: "desc" },
    select: { started_at: true, input_tokens: true, output_tokens: true, estimated_cost_usd: true, actual_cost_usd: true },
    take: 200,
  });
  const daily = new Map<string, any>();
  for (const s of d) {
    if (!s.started_at) continue;
    const day = new Date(s.started_at * 1000).toISOString().slice(0, 10);
    const cur = daily.get(day) || { day, sessions: 0, tokens: 0, cost: 0 };
    cur.sessions++;
    cur.tokens += (s.input_tokens || 0) + (s.output_tokens || 0);
    cur.cost += (s.estimated_cost_usd || s.actual_cost_usd || 0);
    daily.set(day, cur);
  }
  return NextResponse.json({ bySource, topSessions, daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)).reverse() });
}