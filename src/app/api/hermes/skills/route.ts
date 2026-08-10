import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Simulated skills data (since we don't have a direct bridge for listing all skills yet)
const builtinSkills: { name: string; description: string; path?: string }[] = [
  { name: "automation", description: "Automation workflows and scripts." },
  { name: "creative", description: "Creative content generation tools." },
  { name: "data-science", description: "Data analysis and visualization." },
  { name: "devops", description: "Infrastructure and deployment automation." },
  { name: "research", description: "Web research and information gathering." },
];

const customSkills: { name: string; description: string; path?: string }[] = []; // Will be populated from DataStore or filesystem later

export async function GET() {
  try {
    // In a real implementation, we might scrape /home/hermes/.hermes/skills/ here
    return NextResponse.json({ builtin: builtinSkills, custom: customSkills });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch skills" }, { status: 500 });
  }
}
