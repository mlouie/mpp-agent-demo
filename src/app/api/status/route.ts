/**
 * Pre-Demo Health Check
 *
 * Hit /api/status before a live demo to verify all dependencies are up.
 */
import { createTempoClient, getAgentAccount } from "@/lib/tempo";
import { publicActions } from "viem";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // Check Tempo RPC
  try {
    const client = createTempoClient().extend(publicActions);
    const blockNumber = await client.getBlockNumber();
    checks.tempo = { ok: true, detail: `Block #${blockNumber}` };
  } catch (e) {
    checks.tempo = { ok: false, detail: (e as Error).message };
  }

  // Check agent wallet
  try {
    const account = getAgentAccount();
    checks.wallet = { ok: true, detail: `Address: ${account.address}` };
  } catch (e) {
    checks.wallet = { ok: false, detail: (e as Error).message };
  }

  // Check Claude API
  try {
    const anthropic = new Anthropic();
    await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 10,
      messages: [{ role: "user", content: "ping" }],
    });
    checks.claude = { ok: true };
  } catch (e) {
    checks.claude = { ok: false, detail: (e as Error).message };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return Response.json({ ok: allOk, checks }, { status: allOk ? 200 : 503 });
}
