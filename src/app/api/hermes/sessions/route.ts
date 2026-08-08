import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get("search");
  const source = url.searchParams.get("source");
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const offset = Number(url.searchParams.get("offset") || 0);
  const sessionId = url.searchParams.get("session_id");

  if (sessionId) {
    const session = await prisma.hermesSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { timestamp: "asc" } } },
    });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    return NextResponse.json(session);
  }

  const where: any = {};
  if (source) where.source = source;

  const [sessions, total] = await Promise.all([
    prisma.hermesSession.findMany({
      where,
      orderBy: { started_at: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.hermesSession.count({ where }),
  ]);

  return NextResponse.json({ sessions, total, limit, offset });
}
