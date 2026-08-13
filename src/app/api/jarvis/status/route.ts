import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [healthStore, stateStore] = await Promise.all([
      prisma.dataStore.findUnique({ where: { key: "hermes-health" } }),
      prisma.dataStore.findUnique({ where: { key: "jarvis-state" } }),
    ]);

    const health = healthStore ? JSON.parse(healthStore.data as string) : { online: false };
    const defaultState = { profile: [], goal: "", personality: "", tasks: [], missions: [] };
    const state = stateStore ? { ...defaultState, ...JSON.parse(stateStore.data as string) } : defaultState;

    return NextResponse.json({
      runtime: health.online ? "hermes" : "unknown",
      model: "best-long-context",
      profile: "default",
      tools: ["terminal", "file", "browser", "web", "computer_use"],
      permission: "normal",
      session: null,
      state,
      voice_mode: "browser",
      browser_stt: true,
      browser_tts: true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
