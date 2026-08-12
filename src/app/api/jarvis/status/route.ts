import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [healthStore, stateStore, recentJobs] = await Promise.all([
      prisma.dataStore.findUnique({ where: { key: "hermes-health" } }),
      prisma.dataStore.findUnique({ where: { key: "jarvis-state" } }),
      prisma.agentRequest.findMany({
        where: { kind: "jarvis-run", origin: "jarvis" },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const health = healthStore ? JSON.parse(healthStore.data as string) : { online: false };
    const defaultState = {
      profile: [] as string[],
      goal: "",
      personality: "",
      tasks: [] as { text: string; done: boolean; at: number }[],
      missions: [] as { id: string; mission: string; status: string; at: number; result?: string }[],
    };
    const state = stateStore ? { ...defaultState, ...JSON.parse(stateStore.data as string) } : defaultState;

    return NextResponse.json({
      runtime: health.online ? "hermes" : "unknown",
      model: "best-long-context",
      profile: "default",
      tools: ["terminal", "file", "browser", "web", "computer_use"],
      session: null,
      jobs: recentJobs,
      state,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
