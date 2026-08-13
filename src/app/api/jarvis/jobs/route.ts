import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const jobs = await prisma.agentRequest.findMany({
      where: { kind: "jarvis-run", origin: "jarvis" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const done = jobs.filter(j => j.status === "done" || j.result);
    const running = jobs.filter(j => j.status === "queued" || j.status === "running");

    return NextResponse.json({
      done: done.map(j => ({ id: j.id, title: j.title, result: j.result || null, finished: j.updatedAt })),
      running: running.map(j => ({ id: j.id, title: j.title, status: j.status, started: j.createdAt })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
