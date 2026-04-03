/**
 * Agent API Route (Streaming NDJSON)
 *
 * Stream 1 of the two-stream architecture:
 * - Stream 1 (this): POST /api/agent -> NDJSON of chat text + tool indicators
 * - Stream 2: GET /api/events -> SSE of payment events (for right panel)
 */
import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent";
import { sessionStore } from "@/lib/session-store";
import type { ChatMessage } from "@/types";

export async function POST(request: NextRequest) {
  let messages: ChatMessage[];
  try {
    const body = await request.json();
    messages = body.messages;
  } catch (e) {
    return Response.json({ error: "Invalid request body", detail: (e as Error).message }, { status: 400 });
  }

  // Open a session if this is the first request in a new conversation
  if (sessionStore.getState().status === "idle") {
    const sessionId = `sess-${Date.now()}`;
    sessionStore.openSession(sessionId);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runAgent(messages, (event) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        });
      } catch (e) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "error", message: (e as Error).message }) + "\n")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
