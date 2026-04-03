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
