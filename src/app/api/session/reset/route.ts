import { sessionStore } from "@/lib/session-store";

export async function POST() {
  sessionStore.reset();
  return Response.json({ ok: true });
}
