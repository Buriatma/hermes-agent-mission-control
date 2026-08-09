import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.hermesSession.findUnique({
    where: { id },
    include: { messages: { orderBy: { timestamp: "asc" } } },
  });
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.hermesMessage.deleteMany({ where: { session_id: id } });
    await prisma.hermesSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || "delete failed" }, { status: 500 });
  }
}
