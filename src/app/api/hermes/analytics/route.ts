import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  const sessions = await prisma.hermesSession.groupBy({ by: ["source"], _count: true, _sum: { totalTokens: true, cost: true }, orderBy: { _count: { source: "desc" } } });
  const daily = await prisma.$queryRaw`SELECT date("createdAt") as day, count(*) as sessions, sum("totalTokens") as tokens, sum(cost) as cost FROM "HermesSession" GROUP BY date("createdAt") ORDER BY day DESC LIMIT 30`;
  const topSessions = await prisma.hermesSession.findMany({ orderBy: { totalTokens: "desc" }, take: 10, select: { id: true, source: true, model: true, totalTokens: true, cost: true, createdAt: true } });
  return NextResponse.json({ bySource: sessions, daily, topSessions });
}
