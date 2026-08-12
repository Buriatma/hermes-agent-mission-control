import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const store = await prisma.dataStore.findUnique({ where: { key: "jarvis-state" } });
    const defaultState = {
      profile: [] as string[],
      goal: "",
      personality: "Concise, helpful, Jarvis-style responses.",
      tasks: [] as { text: string; done: boolean; at: number }[],
      missions: [] as { id: string; mission: string; status: string; at: number; result?: string }[],
    };
    const state = store ? { ...defaultState, ...JSON.parse(store.data as string) } : defaultState;
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const updates = await req.json();
    const store = await prisma.dataStore.findUnique({ where: { key: "jarvis-state" } });
    const current = store ? JSON.parse(store.data as string) : {};
    const merged = { ...current, ...updates };

    await prisma.dataStore.upsert({
      where: { key: "jarvis-state" },
      create: { key: "jarvis-state", data: JSON.stringify(merged) },
      update: { data: JSON.stringify(merged) },
    });

    return NextResponse.json({ ok: true, state: merged });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
