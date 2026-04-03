/**
 * MPP-Gated Restaurant Search API
 *
 * Demonstrates how to gate an existing API endpoint with MPP.
 * The only MPP-specific code is the mppServer.charge() call --
 * everything else is a standard Next.js route handler.
 *
 * Charge: $0.01 per search query (micropayment for API access).
 *
 * To apply this pattern to your own API:
 * 1. Import your shared mppServer instance (see lib/mpp-server.ts)
 * 2. Call mppServer.charge({ amount })(request) at the start of your handler
 * 3. If result.status is 402, return the challenge response
 * 4. Otherwise, do your normal work and wrap the response with result.withReceipt()
 *
 * Production note: In a real deployment, you'd use mainnet RPC and
 * a custody solution (e.g., Fireblocks) for the recipient wallet
 * instead of a raw private key.
 */
import { NextRequest } from "next/server";
import { mppServer } from "@/lib/mpp-server";
import { searchRestaurants } from "@/data/restaurants";
import { sessionStore } from "@/lib/session-store";

export async function GET(request: NextRequest) {
  // --- MPP payment gate ---
  let result;
  try {
    result = await mppServer.charge({ amount: "0.01" })(request);
  } catch (e: unknown) {
    const err = e as Error;
    console.error("[MPP CHARGE ERROR]", err.message, err.stack);
    return Response.json(
      { error: "MPP charge failed", detail: err.message },
      { status: 500 }
    );
  }
  if (result.status === 402) return result.challenge;
  // --- End MPP gate ---

  const cuisine = request.nextUrl.searchParams.get("cuisine") ?? undefined;
  const priceRange = request.nextUrl.searchParams.get("priceRange") as "$" | "$$" | "$$$" | undefined;

  const results = searchRestaurants({ cuisine, priceRange });
  const summary = results.map(({ menu, ...rest }) => ({ ...rest, itemCount: menu.length }));

  sessionStore.addPayment({
    endpoint: `/api/restaurants${cuisine ? `?cuisine=${cuisine}` : ""}`,
    method: "GET",
    amount: 0.01,
    description: `Search: ${cuisine ?? "all"} restaurants`,
  });

  return result.withReceipt(Response.json(summary));
}
