import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const COMMANDS = [
  { name: "/help", desc: "Show available commands" },
  { name: "/status", desc: "Check Hermes health" },
  { name: "/new", desc: "Start new session" },
  { name: "/search", desc: "Search sessions" },
  { name: "/cost", desc: "Show cost breakdown" },
  { name: "/sessions", desc: "List recent sessions" },
  { name: "/cron", desc: "List cron jobs" },
  { name: "/brief", desc: "Trigger daily briefing" },
  { name: "/clear", desc: "Clear current chat" },
];
export async function GET() { return NextResponse.json({ commands: COMMANDS }); }
