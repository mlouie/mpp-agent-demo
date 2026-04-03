"use client";
import type { SessionState } from "@/types";
import { SessionCard } from "./SessionCard";
import { RequestLog } from "./RequestLog";
import { SettlementTimeline } from "./SettlementTimeline";

export function PlatformView({ state }: { state: SessionState }) {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          What DoorDash Sees
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <SessionCard state={state} />
        <RequestLog events={state.events} />
        <SettlementTimeline state={state} />
      </div>
    </div>
  );
}
