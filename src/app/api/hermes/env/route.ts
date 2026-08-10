import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    // Read .env file from project root (or container environment)
    // This is typically mounted or located at /opt/hermes/.env in the container context
    const envPath = process.env.ENV_FILE_PATH || path.join("/opt", "data", ".env");
    
    if (!fs.existsSync(envPath)) {
       return NextResponse.json({ variables: [] });
    }

    const content = fs.readFileSync(envPath, "utf8");
    const variables: Array<{ key: string; value: string; is_sensitive: boolean }> = [];
    
    content.split("\n").forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, ''); // Remove quotes
        const sensitive = /password|token|secret|key/i.test(key);
        variables.push({ key, value: sensitive ? "********" : value, is_sensitive: sensitive });
      }
    });

    return NextResponse.json({ variables });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
