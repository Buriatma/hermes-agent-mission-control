import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  const bm = await prisma.hermesSessionBookmark.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ bookmarks: bm });
}
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.sessionId || !b.title) return NextResponse.json({ error: "sessionId + title required" }, { status: 400 });
  const row = await prisma.hermesSessionBookmark.create({ data: { sessionId: b.sessionId, title: b.title } });
  return NextResponse.json(row);
}
export async function DELETE(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.hermesSessionBookmark.delete({ where: { id: b.id } });
  return NextResponse.json({ ok: true });
}
