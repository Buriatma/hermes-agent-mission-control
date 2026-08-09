import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// SSE endpoint that streams real-time request status updates.
// Each invocation polls DB and pushes status changes, then disconnects
// after ~8s so Vercel serverless doesn't time out. The browser
// EventSource auto-reconnects, creating a continuous stream.
// Terminal states (done/failed) send the final result and close permanently.

const POLL_INTERVAL_MS = 1500;
const MAX_STREAM_MS = 8000; // stay under Vercel 10s limit

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify request exists
    const request = await prisma.agentRequest.findUnique({ where: { id } });
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    // If this request is already terminal and we've never returned a result,
    // send the full stored result immediately (post-Vercel cold-start reconnect).
    if (request.status === "done" || request.status === "completed") {
      const encoder0 = new TextEncoder();
      const stream0 = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: unknown) => {
            try {
              const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder0.encode(payload));
            } catch {}
          };
          const reqId0 = request.id;
          // Fetch the result; also try to look up the Hermes session id if stored.
          send("result", { status: "done", result: request.result || "", requestId: reqId0, sessionId: (request as any).sessionId || null });
          send("done", { status: "done" });
          controller.close();
        },
      });
      return new NextResponse(stream0, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          } catch { /* client disconnected */ }
        };

        let lastStatus = request.status;
        let lastError = request.error;
        let lastResult = request.result;
        const started = Date.now();

        // Send initial status immediately
        send("status", {
          status: request.status,
          error: request.error,
        });

        // Terminal states — send final data and close
        if (request.status === "done" || request.status === "completed") {
          send("result", {
            status: "done",
            result: request.result || "",
          });
          send("done", { status: "done" });
          controller.close();
          return;
        }

        if (request.status === "failed") {
          send("result", {
            status: "failed",
            error: request.error || "Request failed",
          });
          send("done", { status: "failed" });
          controller.close();
          return;
        }

        // Poll for status changes until terminal or timeout
        while (Date.now() - started < MAX_STREAM_MS) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

          try {
            const fresh = await prisma.agentRequest.findUnique({ where: { id } });
            if (!fresh) break;

            // Push event on status change
            if (fresh.status !== lastStatus) {
              lastStatus = fresh.status;
              lastError = fresh.error;
              send("status", {
                status: fresh.status,
                error: fresh.error,
              });
            }

            // Terminal — send result and close
            if (fresh.status === "done" || fresh.status === "completed") {
              send("result", {
                status: "done",
                result: fresh.result || "",
              });
              send("done", { status: "done" });
              controller.close();
              return;
            }

            if (fresh.status === "failed") {
              send("result", {
                status: "failed",
                error: fresh.error || "Request failed",
              });
              send("done", { status: "failed" });
              controller.close();
              return;
            }
          } catch {
            // DB query failed, keep retrying
          }
        }

        // Timeout — send current status, client will reconnect
        send("status", {
          status: lastStatus,
          error: lastError,
          timeout: true,
        });
        send("done", { status: "timeout" });
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to stream response" },
      { status: 500 }
    );
  }
}
