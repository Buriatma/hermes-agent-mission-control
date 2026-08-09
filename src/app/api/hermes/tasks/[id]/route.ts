import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  try {
    const task = await prisma.hermesTask.update({
      where: { id },
      data: {
        title: b.title ? b.title.slice(0, 300) : undefined,
        status: b.status,
        priority: b.priority != null ? Number(b.priority) : undefined,
        assignee: b.assignee || undefined,
        result: b.result || undefined,
      },
    });
    return NextResponse.json({ task });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "update failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.hermesTask.delete({ where: { id } }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
