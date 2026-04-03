/**
 * MPP-Gated Order Placement API
 *
 * Places an order and charges the full order total (including fees, tax, tip)
 * via MPP. Demonstrates DYNAMIC PRICING with MPP.
 *
 * The response includes a full price breakdown matching DoorDash's real
 * checkout experience: subtotal, service fee, delivery fee, tax, tip.
 *
 * Production note: For a real marketplace, you'd validate item
 * availability, apply taxes/fees, and store the order in a database.
 */
import { NextRequest } from "next/server";
import { mppServer } from "@/lib/mpp-server";
import {
  getRestaurantById,
  computeOrderTotal,
  computeOrderFees,
} from "@/data/restaurants";
import { sessionStore } from "@/lib/session-store";

export async function POST(request: NextRequest) {
  const body = await request.clone().json();
  const { restaurantId, itemIds } = body as {
    restaurantId: string;
    itemIds: string[];
  };

  const restaurant = getRestaurantById(restaurantId);
  if (!restaurant) {
    return Response.json(
      { error: `Restaurant not found: ${restaurantId}` },
      { status: 400 }
    );
  }

  let subtotal: number;
  try {
    subtotal = computeOrderTotal(restaurantId, itemIds);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  const fees = computeOrderFees(restaurantId, subtotal);

  // --- MPP payment gate with dynamic amount (full customer total) ---
  const result = await mppServer.charge({ amount: String(fees.total) })(
    request
  );
  if (result.status === 402) return result.challenge;
  // --- End MPP gate ---

  const orderId = `ORD-${Date.now()}`;
  const items = itemIds.map((id) => restaurant.menu.find((m) => m.id === id)!);

  sessionStore.addPayment({
    endpoint: "/api/orders",
    method: "POST",
    amount: fees.total,
    doordashRevenue: fees.doordashRevenue,
    description: `Order from ${restaurant.name}: $${fees.total.toFixed(2)}`,
  });

  // Settle the MPP session -- the order is the final transaction.
  // In a real MPP session, this would close the payment channel and
  // submit the final cumulative voucher on-chain (1 transaction).
  sessionStore.settleSession();

  return result.withReceipt(
    Response.json({
      orderId,
      restaurant: restaurant.name,
      items: items.map((i) => ({ name: i.name, price: i.price })),
      subtotal: fees.subtotal,
      serviceFee: fees.serviceFee,
      deliveryFee: fees.deliveryFee,
      tax: fees.tax,
      tip: fees.tip,
      total: fees.total,
      status: "confirmed",
      estimatedDelivery: restaurant.deliveryTime,
    })
  );
}
