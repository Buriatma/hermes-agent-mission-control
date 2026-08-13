import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const _ = await req.blob();
    // Placeholder STT: in production this would call configured STT backend
    // For now return empty text to satisfy frontend contract
    return NextResponse.json({ text: "" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, text: "" }, { status: 500 });
  }
}
