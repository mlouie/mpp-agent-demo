"use client";
import type { PaymentEvent } from "@/types";

export function RequestLog({ events }: { events: PaymentEvent[] }) {
  const payments = events.filter((e) => e.type === "payment");

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">API Request Log</h3>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-50">
        {payments.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400 italic">
            No requests yet
          </p>
        ) : (
          payments.map((event, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Method badge */}
                {event.method && (
                  <span className="shrink-0 text-xs font-mono font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {event.method}
                  </span>
                )}
                {/* Endpoint */}
                <span className="text-xs font-mono text-gray-500 truncate">
                  {event.endpoint || event.description || "—"}
                </span>
              </div>

              {/* Amount */}
              {event.amount !== undefined && (
                <span className="shrink-0 text-xs font-semibold text-green-600 ml-2">
                  +${(event.amount / 1_000_000).toFixed(4)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
