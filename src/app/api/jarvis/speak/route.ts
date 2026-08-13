import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text } = await req.json().catch(() => ({}));
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

    // Placeholder TTS: in production this would call configured TTS backend
    // For now return empty audio to satisfy frontend contract
    return new NextResponse(Buffer.from(""), {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
