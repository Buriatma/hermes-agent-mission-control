import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Fetch settings from local DataStore
export async function GET() {
  try {
    const row = await prisma.dataStore.findUnique({
      where: { key: "glyteos-settings" },
    });
    const defaultSettings = {
      sttUrl: "http://141.148.193.69:20120/v1/audio/transcriptions",
      sttToken: "sk-8c7d249dd1b8311c-6dv44v-87c8a2b3",
      sttModel: "gemini/gemini-2.5-flash",
      ttsUrl: "http://141.148.193.69:20120/v1/audio/speech",
      ttsToken: "sk-8c7d249dd1b8311c-6dv44v-87c8a2b3",
      ttsModel: "gemini/gemini-3.1-flash-tts-preview/Sulafat",
      waterReminderInterval: 60, // minutes
      breakReminderInterval: 120, // minutes
      wakeWord: "Jarvis",
      voiceModeAutoPlay: true,
    };

    if (!row) {
      return NextResponse.json(defaultSettings);
    }
    return NextResponse.json({ ...defaultSettings, ...JSON.parse(row.data as string) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// Update settings
export async function POST(req: Request) {
  try {
    const data = await req.json();
    const row = await prisma.dataStore.upsert({
      where: { key: "glyteos-settings" },
      update: { data: JSON.stringify(data) },
      create: { key: "glyteos-settings", data: JSON.stringify(data) },
    });
    return NextResponse.json({ settings: data });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
