import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const store = await prisma.dataStore.findUnique({ where: { key: "hermes-git" } });
    if (!store) return NextResponse.json({ commits: [] });
    const data = JSON.parse(String(store.data || "{}"));
    return NextResponse.json({ commits: data.commits || [], branch: "main", syncedAt: data.syncedAt });
  } catch {
    return NextResponse.json({ commits: [], branch: "main" });
  }
}