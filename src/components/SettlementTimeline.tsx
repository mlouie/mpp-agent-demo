"use client";
import type { SessionState } from "@/types";

const EXPLORER_BASE = "https://explore.moderato.tempo.xyz";

function ExplorerLink({ txHash }: { txHash: string }) {
  return (
    <a
      href={`${EXPLORER_BASE}/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-500 hover:text-blue-700 underline font-mono break-all"
    >
      {txHash.slice(0, 10)}…{txHash.slice(-6)}
    </a>
  );
}

interface StepProps {
  completed: boolean;
  label: string;
  detail?: React.ReactNode;
  isLast?: boolean;
}

function Step({ completed, label, detail, isLast }: StepProps) {
  return (
    <div className="flex gap-3">
      {/* Indicator + connector */}
      <div className="flex flex-col items-center">
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
            completed
              ? "border-green-500 bg-green-500"
              : "border-gray-300 bg-white"
          }`}
        >
          {completed && (
            <svg
              className="w-3 h-3 text-white"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 mt-1 ${
              completed ? "bg-green-300" : "bg-gray-200"
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div className={`pb-4 ${isLast ? "" : ""}`}>
        <p
          className={`text-sm font-medium ${
            completed ? "text-gray-800" : "text-gray-400"
          }`}
        >
          {label}
        </p>
        {detail && <div className="mt-0.5">{detail}</div>}
      </div>
    </div>
  );
}

export function SettlementTimeline({ state }: { state: SessionState }) {
  const { status, events, onChainTxns, doordashRevenue } = state;

  const paymentCount = events.filter((e) => e.type === "payment").length;
  const sessionOpened = status !== "idle";
  const paymentsProcessed = paymentCount > 0;
  const settled = status === "settled";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">
          Settlement Timeline
        </h3>
      </div>

      <div className="px-4 py-4">
        {/* Steps */}
        <Step
          completed={sessionOpened}
          label="Session Opened"
          detail={
            onChainTxns.open ? (
              <ExplorerLink txHash={onChainTxns.open} />
            ) : undefined
          }
        />

        <Step
          completed={paymentsProcessed}
          label={`${paymentCount} API Call${paymentCount !== 1 ? "s" : ""} Processed`}
          detail={
            <span className="text-xs text-gray-400">Off-chain vouchers</span>
          }
        />

        <Step
          completed={settled}
          label="Session Settled"
          isLast
          detail={
            onChainTxns.settle ? (
              <ExplorerLink txHash={onChainTxns.settle} />
            ) : undefined
          }
        />

        {/* Settlement callout */}
        {settled && (
          <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
            <p className="text-sm font-medium text-green-800">
              {paymentCount} interaction{paymentCount !== 1 ? "s" : ""},{" "}
              2 on-chain transactions
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              DoorDash revenue:{" "}
              <span className="font-semibold">
                ${doordashRevenue.toFixed(2)}
              </span>
              {" "}(service fees + API access)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
