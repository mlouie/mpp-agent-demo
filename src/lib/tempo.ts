/**
 * Tempo Wallet & Chain Configuration
 *
 * Sets up viem clients and accounts for interacting with the Tempo
 * Moderato testnet. Two accounts are configured:
 *
 * - Agent account: The AI agent's wallet (MPP client / payer)
 * - DoorDash account: The restaurant platform's wallet (MPP server / payee)
 *
 * Production note: In a real deployment, replace raw private keys with
 * a custody solution like Fireblocks or Turnkey. Use `tempo` (mainnet)
 * chain instead of `tempoModerato` (testnet).
 */
import { createClient, http, type Client } from "viem";
import { tempoModerato } from "viem/chains";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function getAgentAccount(): PrivateKeyAccount {
  return privateKeyToAccount(requireEnv("AGENT_PRIVATE_KEY") as `0x${string}`);
}

export function getDoorDashAccount(): PrivateKeyAccount {
  return privateKeyToAccount(requireEnv("DOORDASH_PRIVATE_KEY") as `0x${string}`);
}

export function createTempoClient(account?: PrivateKeyAccount): Client {
  return createClient({
    account,
    chain: tempoModerato,
    transport: http(),
  });
}

export const TESTNET_EXPLORER = "https://explore.moderato.tempo.xyz";

export function txExplorerUrl(txHash: string): string {
  return `${TESTNET_EXPLORER}/tx/${txHash}`;
}
