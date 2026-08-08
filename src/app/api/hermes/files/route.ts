import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parent = url.searchParams.get("parent") || null;
  const type = url.searchParams.get("type") || undefined;
  const filePath = url.searchParams.get("path");
  const search = url.searchParams.get("q") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") || "200"), 500);

  // Read single file content
  if (filePath) {
    const file = await prisma.hermesFile.findUnique({ where: { path: filePath } });
    if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(file);
  }

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { path: { contains: search, mode: "insensitive" } },
    ];
  } else {
    // When no search, show root-level or specific parent
    if (parent) where.parent = parent;
    else where.parent = null;
  }
  if (type) where.type = type;

  const files = await prisma.hermesFile.findMany({
    where,
    orderBy: [{ type: "asc" }, { name: "asc" }],
    take: limit,
  });

  const total = await prisma.hermesFile.count();

  return NextResponse.json({ files, total });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  // Update file after edit — exec dispatch to write file
  if (b.path && typeof b.content === "string") {
    const row = await prisma.agentRequest.create({
      data: {
        origin: "web",
        kind: "file.write",
        title: `writefile:${b.path.slice(0, 60)}`,
        prompt: JSON.stringify({ path: b.path, content: b.content.slice(0, 40000) }),
        sideEffecting: false,
        status: "queued",
      },
    });
    return NextResponse.json({ request: row });
  }
  return NextResponse.json({ error: "path + content required" }, { status: 400 });
}