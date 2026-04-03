/**
 * MPP Server Configuration (DoorDash Side)
 *
 * This is the most important file for a DoorDash engineer evaluating Tempo.
 * It shows how to set up an MPP payment gateway for your APIs.
 *
 * How it works:
 * 1. Create an Mppx server instance with your recipient wallet and currency
 * 2. Use mppx.charge() or mppx.session() to gate any API endpoint
 * 3. When an agent calls your API, mppx automatically:
 *    - Returns a 402 Payment Required challenge
 *    - Verifies the agent's payment credential on retry
 *    - Confirms the on-chain transaction
 *    - Lets the request through with a Payment-Receipt header
 *
 * To apply this to your own APIs:
 * - Replace `testnet: true` with mainnet config
 * - Set `recipient` to your treasury wallet address
 * - Wrap each API route handler with the charge/session pattern (see API routes)
 *
 * Fee sponsorship: Setting `feePayer: true` means DoorDash pays gas fees
 * on behalf of the agent, removing friction. In production, you'd weigh
 * the gas cost (~$0.001) against the payment revenue.
 *
 * ── Demo talking points: Transaction cost savings ──────────────────────
 *
 * Per-order comparison (avg $30 order):
 *
 *   Credit cards (negotiated large-merchant rate):
 *     Processing: ~2.0-2.5% + $0.10-0.15 = ~$0.70-0.90 per order
 *     Chargebacks (~1% rate, ~$20 avg dispute cost): ~$0.15-0.20/order
 *     Effective cost: ~$0.85-1.10 per order
 *
 *   MPP on Tempo:
 *     Gas per session (2 on-chain txns): ~$0.01
 *     Chargebacks: $0 (stablecoin payments are final)
 *
 *   Net savings: ~$0.75-1.00 per order
 *
 * ── Annual savings by agent adoption (DoorDash ~2.5B orders/year) ────
 *
 *   1% agent adoption (Year 1, conservative):
 *     25M agent orders → $19-25M/year savings
 *
 *   5-10% agent adoption (Year 2-3):
 *     125-250M agent orders → $94-250M/year savings
 *
 *   20% agent adoption (Year 3-5, mainstream):
 *     600M agent orders → $450-600M/year savings
 *
 *   Full adoption (hypothetical):
 *     2.5B+ orders → $1.9-2.5B/year savings
 *
 * Key assumptions:
 *   - Agent adoption rate is the biggest variable. DoorDash already has
 *     AI features; every major AI lab is building agent capabilities.
 *   - These savings are ON TOP of normal DoorDash revenue (commissions,
 *     service fees, delivery fees) which are identical for agent orders.
 *   - Chargeback elimination is high-certainty regardless of adoption --
 *     stablecoin payments are final, zero dispute infrastructure needed.
 *   - API browsing fees ($0.01/call) add incremental revenue but the
 *     primary value is abuse prevention, not the revenue itself.
 *
 * One-liner for the demo:
 *   "At 1% agent adoption -- conservative for a year from now -- you're
 *    saving $20M annually on payment processing. At 10%, it's a quarter
 *    billion. And those orders generate your normal fees on top."
 * ───────────────────────────────────────────────────────────────────────
 */
import { Mppx, tempo } from "mppx/server";
import { getDoorDashAccount } from "./tempo";

function createMppServer() {
  const doorDashAccount = getDoorDashAccount();

  // tempo() returns both charge and session method configs.
  // `testnet: true` auto-selects: Moderato chain, pathUSD currency, testnet RPC.
  // `account` must be a full viem Account (not just an address string) so that
  // the session method can sign on-chain channel-close/settlement transactions.
  const methods = tempo({
    account: doorDashAccount,
    testnet: true,
  });

  // MPP_SECRET_KEY env var is required -- used for stateless HMAC verification
  // of payment challenges. Set it in .env.local (any random string works for demos).
  return Mppx.create({ methods });
}

// Singleton: survives Next.js hot-reloads in dev.
// Without this, hot-reloads create a new Mppx instance whose HMAC state
// can't verify challenges issued by the previous instance, causing 500s.
const globalForMpp = globalThis as unknown as { mppServer: ReturnType<typeof createMppServer> };
export const mppServer = globalForMpp.mppServer || createMppServer();
globalForMpp.mppServer = mppServer;
