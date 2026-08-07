import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const chatId = formData.get("chatId") as string;

    if (!file || !chatId) {
      return NextResponse.json({ error: "Missing file or chatId" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Store in /opt/data/attachments (make sure this exists and is writable by web server)
    const uploadDir = path.join(process.cwd(), "public/attachments");
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const filePath = path.join(uploadDir, filename);

    // In a real production app, we'd upload to S3/Supabase. 
    // For now, we write to the local filesystem.
    await writeFile(filePath, buffer);

    const fileUrl = `/attachments/${filename}`;

    // Link to AgentRequest if chatId is a request ID
    const request = await prisma.agentRequest.findUnique({
      where: { id: chatId }
    });

    if (request) {
      // Attach to request metadata via JSON if possible, 
      // or we can add an attachment table in a real schema update.
      // For now, we just return the URL for the client to add to message.
      return NextResponse.json({ url: fileUrl, name: file.name });
    }

    return NextResponse.json({ url: fileUrl, name: file.name });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
