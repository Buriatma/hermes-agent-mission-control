import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { message, fresh } = await req.json().catch(() => ({}));
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

    const stateStore = await prisma.dataStore.findUnique({ where: { key: "jarvis-state" } });
    const state = stateStore ? JSON.parse(stateStore.data as string) : {};
    const parts: string[] = [];
    if (state.personality) parts.push(`Tone: ${state.personality}`);
    if (state.goal) parts.push(`Standing objective: ${state.goal}`);
    if (state.profile?.length) parts.push(`Profile notes:\n${state.profile.slice(-10).join("\n")}`);
    const systemContext = parts.length ? parts.join("\n\n") + "\n\n" : "";
    const prompt = systemContext + message;

    const row = await prisma.agentRequest.create({
      data: {
        origin: "jarvis",
        kind: "chat",
        title: message.slice(0, 200),
        prompt,
        sideEffecting: false,
        model: "best-long-context",
        status: "queued",
      },
    });

    return NextResponse.json({ requestId: row.id, status: "queued", session_id: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
