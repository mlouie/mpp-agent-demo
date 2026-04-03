/**
 * MPP-Gated Order Placement API
 *
 * Places an order and charges the full order total via MPP.
 * Demonstrates DYNAMIC PRICING with MPP.
 *
 * Production note: For a real marketplace, you'd validate item
 * availability, apply taxes/fees, and store the order in a database.
 */
import { NextRequest } from "next/server";
import { mppServer } from "@/lib/mpp-server";
import { getRestaurantById, computeOrderTotal } from "@/data/restaurants";
import { sessionStore } from "@/lib/session-store";

export async function POST(request: NextRequest) {
  const body = await request.clone().json();
  const { restaurantId, itemIds } = body as { restaurantId: string; itemIds: string[] };

  const restaurant = getRestaurantById(restaurantId);
  if (!restaurant) {
    return Response.json({ error: `Restaurant not found: ${restaurantId}` }, { status: 400 });
  }

  let total: number;
  try {
    total = computeOrderTotal(restaurantId, itemIds);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  // --- MPP payment gate with dynamic amount ---
  const result = await mppServer.charge({ amount: String(total) })(request);
  if (result.status === 402) return result.challenge;
  // --- End MPP gate ---

  const orderId = `ORD-${Date.now()}`;
  const items = itemIds.map((id) => restaurant.menu.find((m) => m.id === id)!);

  sessionStore.addPayment({
    endpoint: "/api/orders",
    method: "POST",
    amount: total,
    description: `Order from ${restaurant.name}: $${total.toFixed(2)}`,
  });

  return result.withReceipt(
    Response.json({
      orderId,
      restaurant: restaurant.name,
      items: items.map((i) => ({ name: i.name, price: i.price })),
      total,
      status: "confirmed",
      estimatedDelivery: restaurant.deliveryTime,
    })
  );
}
