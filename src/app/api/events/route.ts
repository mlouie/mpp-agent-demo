/**
 * SSE Payment Events Endpoint
 *
 * Stream 2 of the two-stream architecture. The frontend opens an
 * EventSource connection to this endpoint on page load. Payment
 * events from the session store are pushed here in real time.
 */
import { sessionStore } from "@/lib/session-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const currentState = sessionStore.getState();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "init", state: currentState })}\n\n`));

      unsub = sessionStore.subscribe((event) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller closed (client disconnected) -- clean up
          closed = true;
          unsub?.();
        }
      });
    },
    cancel() {
      closed = true;
      unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
