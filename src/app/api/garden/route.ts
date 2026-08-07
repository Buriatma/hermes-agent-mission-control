import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      plants: [
        {
          id: "plant-1",
          name: "Indoor Palm",
          emoji: "🌴",
          location: "indoor",
          waterSchedule: "Sundays",
          waterDays: [0],
          tip: "Keep in indirect sunlight"
        },
        {
          id: "plant-2",
          name: "Aloe Vera",
          emoji: "🪴",
          location: "indoor",
          waterSchedule: "Wednesdays",
          waterDays: [3],
          tip: "Do not overwater"
        }
      ]
    };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch garden' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return NextResponse.json({ ok: true });
}
