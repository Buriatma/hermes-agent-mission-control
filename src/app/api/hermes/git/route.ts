import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const REPO = "/opt/data/home/hermes-agent-mission-control";

export async function GET() {
  const { execFileSync } = await import("node:child_process");
  try {
    const log = execFileSync("git", ["-C", REPO, "log", "--oneline", "-20"], { encoding: "utf-8", timeout: 10000 });
    const status = execFileSync("git", ["-C", REPO, "status", "--short"], { encoding: "utf-8", timeout: 10000 });
    const commits = log.trim().split("\n").filter(Boolean).map(line => {
      const [hash, ...rest] = line.split(" ");
      return { hash: hash.slice(0, 7), message: rest.join(" ") };
    });
    const dirty = status.trim().split("\n").filter(Boolean).length;
    return NextResponse.json({ commits, dirty, branch: "main" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}