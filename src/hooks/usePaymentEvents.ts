"use client";
import { useState, useEffect, useCallback } from "react";
import type { PaymentEvent, SessionState } from "@/types";

const INITIAL_STATE: SessionState = {
  sessionId: "", status: "idle", events: [], totalSpent: 0, doordashRevenue: 0, onChainTxns: {},
};

export function usePaymentEvents() {
  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  useEffect(() => {
    const eventSource = new EventSource("/api/events");
    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "init") { setState(event.state); return; }
      setState((prev) => {
        const updated = { ...prev, events: [...prev.events, event] };
        switch (event.type as PaymentEvent["type"]) {
          case "session_open":
            updated.status = "open";
            updated.sessionId = event.sessionId || prev.sessionId;
            if (event.txHash) updated.onChainTxns = { ...prev.onChainTxns, open: event.txHash };
            break;
          case "payment":
            updated.totalSpent = prev.totalSpent + (event.amount || 0);
            updated.doordashRevenue = prev.doordashRevenue + (event.doordashRevenue ?? event.amount ?? 0);
            break;
          case "session_settle":
            updated.status = "settled";
            updated.totalSpent = event.totalSpent ?? prev.totalSpent;
            if (event.txHash) updated.onChainTxns = { ...prev.onChainTxns, settle: event.txHash };
            break;
          case "session_reset":
            return INITIAL_STATE;
        }
        return updated;
      });
    };
    eventSource.onerror = () => {};
    return () => eventSource.close();
  }, []);

  const reset = useCallback(async () => {
    await fetch("/api/session/reset", { method: "POST" });
    setState(INITIAL_STATE);
  }, []);

  return { state, reset };
}
