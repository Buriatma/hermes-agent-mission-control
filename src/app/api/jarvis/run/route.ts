import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { message, command } = await req.json().catch(() => ({}));
    if (!message && !command) {
      return NextResponse.json({ error: "message or command required" }, { status: 400 });
    }

    const title = (command || message || "").toString().slice(0, 200);
    const prompt = (command ? `/jarvis ${command} ${message}` : message) || "";

    const row = await prisma.agentRequest.create({
      data: {
        origin: "jarvis",
        kind: "jarvis-run",
        title,
        prompt,
        sideEffecting: false,
        model: "best-long-context",
        status: "queued",
      },
    });

    return NextResponse.json({ requestId: row.id, status: "queued", title });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
