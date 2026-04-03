/**
 * MPP-Gated Menu Lookup API
 *
 * Returns the full menu for a specific restaurant.
 * Charge: $0.01 per menu lookup.
 * Same MPP pattern as the restaurant search route.
 */
import { NextRequest } from "next/server";
import { mppServer } from "@/lib/mpp-server";
import { getRestaurantById } from "@/data/restaurants";
import { sessionStore } from "@/lib/session-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await mppServer.charge({ amount: "0.01" })(request);
  if (result.status === 402) return result.challenge;

  const { id } = await params;
  const restaurant = getRestaurantById(id);

  if (!restaurant) {
    return result.withReceipt(
      Response.json({ error: `Restaurant not found: ${id}` }, { status: 404 })
    );
  }

  sessionStore.addPayment({
    endpoint: `/api/menu/${id}`,
    method: "GET",
    amount: 0.01,
    description: `Menu: ${restaurant.name}`,
  });

  return result.withReceipt(Response.json(restaurant));
}
