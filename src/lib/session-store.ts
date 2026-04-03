/**
 * In-Memory Session Store
 *
 * DEMO SCAFFOLDING: This store exists only to power the payment dashboard
 * visualization. In production, you would NOT need this -- MPP session state
 * lives in the protocol itself. DoorDash would use Tempo's block explorer
 * or their own indexer for payment reporting.
 */
import { EventEmitter } from "events";
import type { PaymentEvent, SessionState } from "@/types";

export class SessionStore {
  private state: SessionState;
  private emitter: EventEmitter;
  private paymentIndex: number;

  constructor() {
    this.state = this.createInitialState();
    this.emitter = new EventEmitter();
    this.paymentIndex = 0;
  }

  private createInitialState(): SessionState {
    return { sessionId: "", status: "idle", events: [], totalSpent: 0, onChainTxns: {} };
  }

  getState(): SessionState {
    return { ...this.state, events: [...this.state.events] };
  }

  openSession(sessionId: string, txHash?: string): void {
    this.state.sessionId = sessionId;
    this.state.status = "open";
    if (txHash) this.state.onChainTxns.open = txHash;
    this.paymentIndex = 0;
    const event: PaymentEvent = { type: "session_open", timestamp: Date.now(), sessionId, txHash };
    this.state.events.push(event);
    this.emitter.emit("event", event);
  }

  addPayment(details: { endpoint: string; method: string; amount: number; description: string }): void {
    this.paymentIndex++;
    this.state.totalSpent += details.amount;
    const event: PaymentEvent = {
      type: "payment", timestamp: Date.now(), endpoint: details.endpoint,
      method: details.method, amount: details.amount, voucherIndex: this.paymentIndex,
      description: details.description,
    };
    this.state.events.push(event);
    this.emitter.emit("event", event);
  }

  settleSession(txHash?: string): void {
    this.state.status = "settled";
    if (txHash) this.state.onChainTxns.settle = txHash;
    const event: PaymentEvent = { type: "session_settle", timestamp: Date.now(), totalSpent: this.state.totalSpent, txHash };
    this.state.events.push(event);
    this.emitter.emit("event", event);
  }

  reset(): void {
    this.state = this.createInitialState();
    this.paymentIndex = 0;
    const event: PaymentEvent = { type: "session_reset", timestamp: Date.now() };
    this.emitter.emit("event", event);
  }

  subscribe(listener: (event: PaymentEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}

// Singleton: survives Next.js hot-reloads in dev
const globalForStore = globalThis as unknown as { sessionStore: SessionStore };
export const sessionStore = globalForStore.sessionStore || new SessionStore();
globalForStore.sessionStore = sessionStore;
