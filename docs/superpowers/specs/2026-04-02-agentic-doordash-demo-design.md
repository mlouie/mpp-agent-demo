# Agentic DoorDash Demo -- Tempo MPP SDK

**Date:** 2026-04-02
**Purpose:** A full-stack demo for a Tempo Solutions Engineer interview, demonstrating Tempo's Machine Payments Protocol (MPP) to DoorDash. The demo shows how DoorDash can capture revenue from the coming wave of AI agent commerce by gating their APIs with MPP.

---

## Narrative Framing

The demo is pitched **to** DoorDash. The core message:

> "A wave of AI agents is coming that will want to order food, book deliveries, and interact with your platform autonomously. MPP gives you a way to monetize that new channel -- letting agents pay per-API-call with instant settlement, no credit card fraud, no chargebacks, no billing infrastructure to build."

DoorDash is the **MPP server** (receiving payments). External AI agents are **MPP clients** (paying for API access). This positions DoorDash as the beneficiary, not the integrator.

### Demo Beats (Live Presentation Flow)

1. **"Why Now"** -- AI agents are becoming autonomous consumers. There's no standard for how they pay. MPP (co-authored by Stripe) is that standard.
2. **"The Integration"** -- Show the `mppx.charge()` one-liner. DoorDash adds one middleware to gate their APIs. The agent hits a 402, pays automatically.
3. **"The Economics"** -- Micropayments for browsing ($0.01/call), real charges for orders. All settled in stablecoins in <1 second. No interchange, no chargebacks, no 2-day clearing.
4. **"The Scale Story"** -- MPP sessions collapse thousands of interactions into 2 on-chain transactions. Structured memos enable automatic ERP reconciliation.

---

## Architecture

```
+---------------------------------------------------+
|                Next.js 15 Frontend                 |
|  +------------------------+----------------------+ |
|  |   Agent Chat Panel     | DoorDash Platform    | |
|  |   "The Customer"       | View "What DoorDash  | |
|  |                        |  Sees"               | |
|  +------------------------+----------------------+ |
+---------------------------------------------------+
|              Next.js API Routes                    |
|                                                    |
|  +---------------+       +----------------------+  |
|  |  AI Agent     |--402--|  "DoorDash" API      |  |
|  |  (MPP Client  |--pay->|  (MPP Server)        |  |
|  |   + Claude)   |<-data-|  mppx.charge()       |  |
|  +---------------+       +----------------------+  |
+---------------------------------------------------+
|              Tempo Testnet (Moderato)               |
|  Chain ID: 42431                                    |
|  RPC: https://rpc.moderato.tempo.xyz                |
|  MPP Session: open --> settle                       |
+---------------------------------------------------+
```

### Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **AI:** Anthropic Claude API (tool use / function calling)
- **Payments:** Tempo `mppx` SDK (MPP client + server)
- **Blockchain:** Tempo Moderato testnet
- **Real-time:** Server-Sent Events (SSE)

---

## Frontend Design

### Layout
Split-screen, 50/50 on desktop. Top bar with demo title: "Agentic Commerce on Tempo -- DoorDash Demo". Clean, professional aesthetic -- Stripe Dashboard style, not DeFi/crypto aesthetics.

### Left Panel -- "The Agent"
- Chat interface with text input at bottom
- Agent responses as chat bubbles with "thinking" indicator
- Inline status pills for key moments: `Searching restaurants...`, `Comparing menus...`, `Placing order...`
- Each status pill that involves an API call shows a small cost badge (e.g., `$0.01`)

### Right Panel -- "What DoorDash Sees"
- **Active MPP Session Card** -- Session ID, status (open/settling/settled), running revenue total
- **API Request Log** -- Live-updating list of incoming agent requests with per-call charges:
  - `GET /api/restaurants?cuisine=thai` -- $0.01
  - `GET /api/menu/somtum-thai` -- $0.01
  - `GET /api/menu/pad-thai-palace` -- $0.01
  - `POST /api/orders` -- $22.50
- **Settlement Timeline** -- Visual progression: Session Opened -> N vouchers signed -> Session Settled. Highlights: "4 interactions, 2 on-chain transactions"
- **On-chain Proof** -- Clickable link to Tempo block explorer showing the real settlement transaction

---

## Backend Design

### 1. "DoorDash" Restaurant APIs (MPP Server)

Three endpoints gated by `mppx.charge()`:

| Endpoint | Method | MPP Charge | Description |
|----------|--------|------------|-------------|
| `/api/restaurants` | GET | $0.01 | Search by cuisine, price range |
| `/api/menu/[restaurantId]` | GET | $0.01 | Full menu for a restaurant |
| `/api/orders` | POST | Order total | Place an order (sum of item prices) |

Server setup:
```ts
// Using AlphaUSD (testnet stablecoin) as the payment currency
const mppServer = Mppx.create({
  methods: [tempo({ currency: ALPHA_USD, recipient: doorDashWallet })]
});
export const GET = mppServer.charge({ amount: 0.01 })(handler);
```

### 2. AI Agent (MPP Client + Claude)

Single route handler: `POST /api/agent`

Flow:
1. Receives user message from chat UI
2. Calls Claude (Anthropic API) with tool use
3. When Claude calls a tool, the agent makes the corresponding MPP-gated API call via `mppx` client SDK (automatic 402 -> pay -> retry)
4. Emits payment events via SSE
5. Returns Claude's response + payment events to frontend

### 3. Real-time Event Stream (SSE)

The agent route streams payment events to the frontend as they happen:
```ts
{ type: "session_open", sessionId: string, txHash: string }
{ type: "payment", endpoint: string, amount: number, voucherIndex: number, description: string }
{ type: "session_settle", totalSpent: number, txHash: string }
```

### Wallet Setup

Two testnet wallets (private keys in `.env`):
- **Agent wallet** -- MPP client, funded with testnet stablecoins
- **DoorDash wallet** -- MPP server recipient, receives payments

---

## Data Model

No database. All data hardcoded in `src/data/restaurants.ts`.

### Restaurant Catalog

```ts
type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  priceRange: "$" | "$$" | "$$$";
  rating: number;
  deliveryTime: string;
  menu: MenuItem[];
};

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  tags: string[]; // e.g., ["spicy", "vegetarian"]
};
```

5 restaurants: Thai, Mexican, Italian, Japanese, American. Each with 6-8 items, realistic names and prices ($8-25).

### Session State (in-memory)

```ts
type PaymentEvent = {
  timestamp: number;
  endpoint: string;
  method: string;
  amount: number;
  voucherIndex: number;
  description: string;
};

type SessionState = {
  sessionId: string;
  status: "open" | "settling" | "settled";
  events: PaymentEvent[];
  totalSpent: number;
  onChainTxns: {
    open?: string;
    settle?: string;
  };
};
```

Held in memory on the server. Resets on each new conversation.

### MPP Session Lifecycle

1. **Session opens** on the agent's first API call (1 on-chain transaction)
2. **Vouchers are signed off-chain** for each subsequent API call (no on-chain cost)
3. **Session settles** after the order is placed and the agent explicitly closes the session (1 on-chain transaction)
4. Total: 2 on-chain transactions regardless of how many API calls were made

---

## AI Agent Design

### Claude Configuration

- **Model:** Claude Sonnet (fast, capable enough for tool use)
- **System prompt:** Frames Claude as a food ordering assistant that is budget-aware, thorough (checks multiple restaurants), and confirms before ordering.

### Tools

| Tool | Maps to API | When Claude uses it |
|------|-------------|-------------------|
| `search_restaurants` | `GET /api/restaurants` | First step -- find matching restaurants |
| `get_menu` | `GET /api/menu/[id]` | Compare options, check prices |
| `place_order` | `POST /api/orders` | After confirming selection with user |

### Behavioral Goals

- **Multi-step reasoning:** Claude browses 2-3 restaurants before picking one (generates multiple micropayments, which is the demo's visual payoff)
- **Budget awareness:** Respects price constraints from the user
- **Confirmation before ordering:** Creates a natural pause for the presenter to narrate the payment flow on the right panel
- **At least 3-4 API calls per session:** The system prompt encourages thoroughness to showcase MPP session value

---

## Error Handling & Demo Resilience

### Failure Modes

| Failure | Handling |
|---------|----------|
| Tempo testnet down | Fallback mode: right panel shows "simulated" badge with cached payment data. Chat still works. |
| Claude API slow/down | "Thinking..." state with 15s timeout. Friendly message on failure. |
| MPP session fails to open | Error displayed in right panel session card. Agent explains the issue in chat. |
| Insufficient testnet funds | Balance check on startup with warning banner. Pre-fund generously. |

### Pre-demo Health Check

Hidden `/status` route that checks:
- Tempo RPC connectivity
- Agent wallet balance
- Claude API reachability
- Returns simple green/red status for each

### Explicitly Out of Scope

- Authentication / authorization
- Concurrent sessions
- Persistent order history
- Real restaurant data
- Mobile responsive design

---

## Project Structure

```
src/
  app/
    page.tsx                  # Main split-screen layout
    api/
      restaurants/route.ts    # MPP-gated restaurant search
      menu/[id]/route.ts      # MPP-gated menu lookup
      orders/route.ts         # MPP-gated order placement
      agent/route.ts          # AI agent (MPP client + Claude)
      events/route.ts         # SSE endpoint for payment events
      status/route.ts         # Health check
  components/
    ChatPanel.tsx             # Left panel - agent chat
    PlatformView.tsx          # Right panel - DoorDash dashboard
    SessionCard.tsx           # MPP session status card
    RequestLog.tsx            # API request log with charges
    SettlementTimeline.tsx    # Visual settlement progression
  data/
    restaurants.ts            # Hardcoded restaurant catalog
  lib/
    mpp-server.ts             # MPP server setup
    mpp-client.ts             # MPP client setup
    agent.ts                  # Claude agent logic with tools
    tempo.ts                  # Tempo wallet/chain config
    session-store.ts          # In-memory session state
  types/
    index.ts                  # Shared TypeScript types
```

---

## Dependencies

```json
{
  "next": "^15",
  "react": "^19",
  "tailwindcss": "^4",
  "mppx": "latest",
  "viem": "^2.43.0",
  "@anthropic-ai/sdk": "latest",
  "tempo.ts": "latest"
}
```

Note: `viem` 2.43.0+ has Tempo chain support built in via `viem/tempo`.
