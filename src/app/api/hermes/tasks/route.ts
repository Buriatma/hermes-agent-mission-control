import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const title = (b.title || "").toString().trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  try {
    const task = await prisma.hermesTask.create({
      data: {
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        board: b.board || "default",
        title: title.slice(0, 300),
        status: b.status || "todo",
        priority: b.priority != null ? Number(b.priority) : null,
        assignee: b.assignee || null,
      },
    });
    return NextResponse.json({ task });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "create failed" }, { status: 500 });
  }
}