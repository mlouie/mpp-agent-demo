import { describe, it, expect, beforeEach } from "vitest";
import { SessionStore } from "../session-store";
import type { PaymentEvent } from "@/types";

describe("SessionStore", () => {
  let store: SessionStore;
  beforeEach(() => { store = new SessionStore(); });

  it("starts in idle state", () => {
    const state = store.getState();
    expect(state.status).toBe("idle");
    expect(state.events).toHaveLength(0);
    expect(state.totalSpent).toBe(0);
  });

  it("opens a session", () => {
    store.openSession("session-123", "0xabc");
    const state = store.getState();
    expect(state.status).toBe("open");
    expect(state.sessionId).toBe("session-123");
    expect(state.onChainTxns.open).toBe("0xabc");
  });

  it("adds payment events and updates total", () => {
    store.openSession("session-123");
    store.addPayment({ endpoint: "/api/restaurants", method: "GET", amount: 0.01, description: "Search restaurants" });
    const state = store.getState();
    expect(state.events).toHaveLength(2); // session_open + payment
    expect(state.totalSpent).toBeCloseTo(0.01);
  });

  it("tracks cumulative total across multiple payments", () => {
    store.openSession("session-123");
    store.addPayment({ endpoint: "/api/restaurants", method: "GET", amount: 0.01, description: "Search" });
    store.addPayment({ endpoint: "/api/menu/somtum-thai", method: "GET", amount: 0.01, description: "Menu lookup" });
    expect(store.getState().totalSpent).toBeCloseTo(0.02);
  });

  it("settles a session", () => {
    store.openSession("session-123");
    store.addPayment({ endpoint: "/api/restaurants", method: "GET", amount: 0.01, description: "Search" });
    store.settleSession("0xdef");
    const state = store.getState();
    expect(state.status).toBe("settled");
    expect(state.onChainTxns.settle).toBe("0xdef");
  });

  it("resets to idle state", () => {
    store.openSession("session-123");
    store.addPayment({ endpoint: "/api/restaurants", method: "GET", amount: 0.01, description: "Search" });
    store.reset();
    const state = store.getState();
    expect(state.status).toBe("idle");
    expect(state.events).toHaveLength(0);
    expect(state.totalSpent).toBe(0);
  });

  it("emits events to subscribers", () => {
    const received: PaymentEvent[] = [];
    store.subscribe((event) => received.push(event));
    store.openSession("session-123");
    store.addPayment({ endpoint: "/api/restaurants", method: "GET", amount: 0.01, description: "Search" });
    expect(received).toHaveLength(2);
    expect(received[0].type).toBe("session_open");
    expect(received[1].type).toBe("payment");
  });

  it("unsubscribe stops events", () => {
    const received: PaymentEvent[] = [];
    const unsub = store.subscribe((event) => received.push(event));
    store.openSession("session-123");
    unsub();
    store.addPayment({ endpoint: "/api/restaurants", method: "GET", amount: 0.01, description: "Search" });
    expect(received).toHaveLength(1); // only session_open
  });
});
