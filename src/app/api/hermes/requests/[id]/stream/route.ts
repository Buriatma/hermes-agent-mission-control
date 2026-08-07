import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// SSE endpoint that streams Hermes execution results in real-time
function* sendMessageStream(message: string) {
  // Send initial event
  yield `${JSON.stringify({ type: "message", content: message })}\n\n`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only allow streaming for completed requests (bridge gives final result)
  // We stream the full result rather than tokens (simpler, more reliable)
  try {
    const { id } = await params;
    const request = await prisma.agentRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (request.status === "failed") {
      return NextResponse.json({ error: request.error || "Execution failed" }, { status: 500 });
    }

    if (request.status !== "done" && request.status !== "completed") {
      return NextResponse.json({ error: "Request still in progress", status: request.status }, { status: 202 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send the complete result in one chunk
          const chunk = encoder.encode(
            `${JSON.stringify({ type: "message", content: request.result || "" })}\n\n`
          );
          controller.enqueue(chunk);
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to stream response" }, { status: 500 });
  }
}