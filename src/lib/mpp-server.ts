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
 * Traditional credit card processing on a $20 order:
 *   Interchange + processing: ~2.0% + $0.15 = ~$0.55 per order
 *   Chargebacks (~1-2% rate, ~$15-25 per dispute): adds ~$0.15-0.25
 *   Effective cost: ~$0.70-0.80 per order
 *
 * MPP on Tempo:
 *   Gas per on-chain transaction: ~$0.001-0.005
 *   MPP session (2 on-chain txns total): ~$0.01
 *   Chargebacks: $0 (stablecoin payments are final)
 *
 * Per-order savings: ~$0.55-0.75
 *
 * At DoorDash scale (~5M+ orders/day):
 *   100K agent orders/day → ~$20M/year savings + ~$7M/year new API revenue
 *   500K agent orders/day → ~$100M/year savings + ~$36M/year new API revenue
 *   1M agent orders/day  → ~$200M/year savings + ~$73M/year new API revenue
 *
 * Key insight: $0.01 API browsing fees are IMPOSSIBLE on credit cards
 * (Visa interchange minimum alone is ~$0.10-0.30). MPP creates an
 * entirely new revenue stream that traditional payment rails can't support.
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
