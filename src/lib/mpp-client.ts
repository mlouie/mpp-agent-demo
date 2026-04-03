/**
 * MPP Client Configuration (Agent Side)
 *
 * This is the AI agent's payment capability. When the agent calls an
 * MPP-gated API and receives a 402, the mppx client automatically:
 * 1. Parses the payment challenge from the WWW-Authenticate header
 * 2. Signs a payment transaction with the agent's wallet
 * 3. Retries the request with the payment credential
 *
 * Production note: In a real system, this is the AI agent's SDK --
 * DoorDash wouldn't write this code. But understanding the client
 * side helps you reason about the full MPP protocol flow.
 *
 * IMPORTANT: We use polyfill: false to avoid replacing globalThis.fetch,
 * which would interfere with other HTTP clients (like the Anthropic SDK).
 * Instead, we export mppFetch() for explicit MPP-aware requests.
 */
import { Mppx, tempo } from "mppx/client";
import { getAgentAccount } from "./tempo";

const agentAccount = getAgentAccount();

const mppClient = Mppx.create({
  methods: [
    tempo({
      account: agentAccount,
    }),
  ],
  polyfill: false, // Don't replace globalThis.fetch -- would break Claude API calls
});

/**
 * MPP-aware fetch. Drop-in replacement for fetch() that automatically
 * handles 402 Payment Required challenges by signing and submitting
 * payment transactions on the Tempo blockchain.
 */
export const mppFetch = mppClient.fetch;
