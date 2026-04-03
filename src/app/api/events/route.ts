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
  const stream = new ReadableStream({
    start(controller) {
      const currentState = sessionStore.getState();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "init", state: currentState })}\n\n`));

      const unsub = sessionStore.subscribe((event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });

      // Store cleanup for when connection closes
      (controller as unknown as { _cleanup: () => void })._cleanup = unsub;
    },
    cancel() {
      // Client disconnected
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
