import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const store = await prisma.dataStore.findUnique({ where: { key: "hermes-health" } });
    const health = store ? JSON.parse(store.data as string) : { online: false };

    const jobs = await prisma.agentRequest.findMany({
      where: { kind: "jarvis-mission" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      runtime: health.online ? "hermes" : "unknown",
      model: "best-long-context",
      profile: "default",
      tools: ["terminal", "file", "browser", "web", "computer_use"],
      session: null,
      jobs,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
