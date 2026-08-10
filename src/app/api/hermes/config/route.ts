import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Read config.yaml (assumed to be in .hermes directory relative to project root for now)
export async function GET() {
  try {
    // Try to read config from standard hermes locations
    const candidates = [
      path.join(process.env.HOME || "/root", ".hermes", "config.yaml"),
      path.join("/opt", "hermes", "config.yaml"), // Inside container default
    ];
    
    let content = "";
    let sourcePath = "";
    
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, "utf8");
        sourcePath = p;
        break;
      }
    }

    if (!content) return NextResponse.json({ error: "Config not found" }, { status: 404 });

    // Simple YAML parser (handles basic key: value nesting)
    const config = parseSimpleYaml(content);
    return NextResponse.json({ config, source: sourcePath });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseSimpleYaml(yaml: string): Record<string, any> {
  const result: Record<string, any> = {};
  let currentSection: string | null = null;

  yaml.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    // Check indentation
    const indent = line.search(/\S|$/);
    const match = /^(\w[\w\s\-]*)\s*:\s*(.*)$/.exec(trimmed);

    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();

      if (indent === 0) {
        currentSection = key;
        result[key] = {};
      } else if (currentSection && val) {
        result[currentSection][key] = val;
      }
    }
  });
  return result;
}
