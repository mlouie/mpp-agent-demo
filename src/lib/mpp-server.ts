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

const doorDashAccount = getDoorDashAccount();

// tempo() returns both charge and session method configs.
// `testnet: true` auto-selects: Moderato chain, pathUSD currency, testnet RPC.
// No need for TEMPO_RPC_URL env var -- testnet mode handles it.
const methods = tempo({
  recipient: doorDashAccount.address,
  testnet: true,
});

// MPP_SECRET_KEY env var is required -- used for stateless HMAC verification
// of payment challenges. Set it in .env.local (any random string works for demos).
export const mppServer = Mppx.create({
  methods,
});
