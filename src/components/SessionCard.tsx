"use client";
import type { SessionState } from "@/types";

const STATUS_BADGE: Record<
  SessionState["status"],
  { label: string; className: string }
> = {
  idle:     { label: "Waiting",   className: "bg-gray-100 text-gray-500" },
  open:     { label: "Active",    className: "bg-blue-100 text-blue-700" },
  settling: { label: "Settling",  className: "bg-yellow-100 text-yellow-700" },
  settled:  { label: "Settled",   className: "bg-green-100 text-green-700" },
};

function truncate(str: string, n = 20) {
  if (!str) return "";
  return str.length > n ? str.slice(0, 8) + "…" + str.slice(-6) : str;
}

export function SessionCard({ state }: { state: SessionState }) {
  const badge = STATUS_BADGE[state.status];
  const paymentEvents = state.events.filter((e) => e.type === "payment");
  const onChainCount = Object.values(state.onChainTxns).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">MPP Session</h3>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {state.status === "idle" ? (
          <p className="text-sm text-gray-400 italic">
            Waiting for agent activity...
          </p>
        ) : (
          <div className="space-y-3">
            {/* Session ID */}
            {state.sessionId && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                  Session ID
                </p>
                <p className="text-xs font-mono text-gray-600 break-all">
                  {truncate(state.sessionId, 24)}
                </p>
              </div>
            )}

            {/* Stats row */}
            <div className="flex gap-6">
              {/* API calls */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                  API Calls
                </p>
                <p className="text-lg font-semibold text-gray-800">
                  {paymentEvents.length}
                </p>
              </div>

              {/* On-chain txns */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                  On-chain Txns
                </p>
                <p className="text-lg font-semibold text-gray-800">
                  {onChainCount}
                </p>
              </div>
            </div>

            {/* Revenue */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                Revenue
              </p>
              <p className="text-2xl font-bold text-green-600">
                ${(state.totalSpent / 1_000_000).toFixed(4)}
                <span className="text-sm font-normal text-gray-400 ml-1">
                  USDC
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
