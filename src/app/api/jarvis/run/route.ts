import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { message, fresh } = await req.json().catch(() => ({}));
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

    // Load jarvis state for context
    const store = await prisma.dataStore.findUnique({ where: { key: "jarvis-state" } });
    const state = store ? JSON.parse(store.data as string) : {};
    const parts: string[] = [];
    if (state.personality) parts.push(`Tone: ${state.personality}`);
    if (state.goal) parts.push(`Standing objective: ${state.goal}`);
    if (state.profile?.length) parts.push(`Profile notes:\n${state.profile.slice(-10).join("\n")}`);

    const systemContext = parts.length ? parts.join("\n\n") + "\n\n" : "";
    const prompt = systemContext + message;

    // Queue via existing dispatch mechanism
    const row = await prisma.agentRequest.create({
      data: {
        origin: "jarvis",
        kind: "jarvis-run",
        title: message.slice(0, 200),
        prompt,
        sideEffecting: false,
        model: "best-long-context",
        status: "queued",
      },
    });

    return NextResponse.json({ requestId: row.id, status: "queued" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
