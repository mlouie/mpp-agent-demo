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
Split-screen, 50/50 on desktop. Top bar with demo title: "Agentic Commerce on Tempo -- DoorDash Demo". Clean, professional aesthetic -- Stripe Dashboard style, not DeFi/crypto aesthetics. A "New Order" button in the top bar resets the session (see Session Reset below).

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

### Session Reset

A "New Order" button in the top bar:
1. Calls `POST /api/session/reset` to clear server-side session state
2. Clears the chat history in the left panel
3. Resets the right panel to an empty "Waiting for agent activity..." state
4. The next agent API call will open a fresh MPP session

Page refresh also triggers a reset via the same mechanism (session state is in-memory, so a server restart naturally clears it; the frontend clears its local state on mount if no active session exists).

---

## Backend Design

### 1. "DoorDash" Restaurant APIs (MPP Server)

Three endpoints gated by `mppx.charge()`:

| Endpoint | Method | MPP Charge | Description |
|----------|--------|------------|-------------|
| `/api/restaurants` | GET | $0.01 | Search by cuisine, price range |
| `/api/menu/[restaurantId]` | GET | $0.01 | Full menu for a restaurant |
| `/api/orders` | POST | Dynamic (order total) | Place an order (sum of item prices) |

Server setup using AlphaUSD (testnet stablecoin):
```ts
const mppServer = Mppx.create({
  methods: [tempo({ currency: ALPHA_USD, recipient: doorDashWallet })]
});

// Fixed-price endpoints (browsing)
export const GET = mppServer.charge({ amount: 0.01 })(handler);

// Dynamic-price endpoint (ordering)
// The order total is computed from the request body (sum of selected item prices),
// then passed to mppx.charge() at request time.
export const POST = async (req: Request) => {
  const { items } = await req.json();
  const total = computeOrderTotal(items);
  return mppServer.charge({ amount: total })(orderHandler)(req);
};
```

**Note on MPP payment models:** The `mppx` SDK supports three models: one-time charges, pay-as-you-go sessions, and streamed payments. During implementation, we will determine which model the SDK best supports for our use case by reading the `mppx` source and docs. The ideal is **pay-as-you-go sessions** (open once, sign off-chain vouchers per call, settle once) because the "many interactions, 2 transactions" narrative is the demo's centerpiece. If the SDK's session API requires a different server-side pattern than `mppx.charge()`, we will adapt. The fallback is one-time charges per request, which still demonstrates MPP but with more on-chain transactions. The right panel visualization will reflect whichever model we use.

### 2. AI Agent (MPP Client + Claude)

Single route handler: `POST /api/agent`

This endpoint uses a **streaming response** to deliver the chat text back to the frontend (typewriter effect). Payment events are delivered on a **separate channel** (see section 3).

Flow:
1. Receives user message from chat UI
2. Calls Claude (Anthropic API) with tool use
3. When Claude calls a tool, the agent makes the corresponding MPP-gated API call via `mppx` client SDK (automatic 402 -> pay -> retry)
4. Writes each payment event to the in-memory session store (which the SSE endpoint reads from)
5. Streams Claude's text response back to the frontend as it generates

```ts
// MPP client setup -- polyfills fetch to auto-handle 402 challenges
const mppClient = Mppx.create({
  methods: [tempo({ account: agentWallet })]
});

// When Claude calls a tool like search_restaurants:
const response = await mppClient.fetch("http://localhost:3000/api/restaurants?cuisine=thai");
// mppx automatically: detects 402 -> signs payment -> retries -> returns data
```

### 3. Real-time Payment Events (SSE)

A **dedicated SSE endpoint** (`GET /api/events`) that the frontend connects to on page load. This is separate from the agent chat stream.

The SSE endpoint reads from the in-memory session store and pushes events as they are written by the agent:

```ts
// Event types pushed to the frontend:
{ type: "session_open", sessionId: string, txHash: string }
{ type: "payment", endpoint: string, amount: number, voucherIndex: number, description: string }
{ type: "session_settle", totalSpent: number, txHash: string }
{ type: "session_reset" }
```

**Two-stream architecture summary:**
- **Stream 1** (`POST /api/agent`): Streaming response delivering chat text (left panel)
- **Stream 2** (`GET /api/events`): SSE delivering payment events (right panel)
- Both streams read/write from the shared in-memory session store

### 4. Session Management

- `POST /api/session/reset` -- Clears in-memory session state, pushes a `session_reset` event via SSE

### Wallet Setup

Two testnet wallets (private keys in `.env`):
- **Agent wallet** -- MPP client, funded with testnet stablecoins (AlphaUSD)
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
  status: "idle" | "open" | "settling" | "settled";
  events: PaymentEvent[];
  totalSpent: number;
  onChainTxns: {
    open?: string;
    settle?: string;
  };
};
```

Held in memory on the server. Resets via `POST /api/session/reset` or on server restart.

### MPP Session Lifecycle

1. **Session opens** on the agent's first API call (1 on-chain transaction). Status: `idle` -> `open`.
2. **Vouchers are signed off-chain** for each subsequent API call (no on-chain cost). Each voucher increments the cumulative amount owed.
3. **Session settles** after the order is placed and the agent explicitly closes the session (1 on-chain transaction). Status: `open` -> `settling` -> `settled`.
4. Total: 2 on-chain transactions regardless of how many API calls were made.

**Implementation note:** This lifecycle describes the ideal pay-as-you-go session model. If the `mppx` SDK's session API works differently (e.g., requires server-side session management, or sessions are implicit), we will adapt the implementation while preserving the narrative. The key demo point -- "many interactions collapsed into few transactions" -- holds regardless of the specific API shape.

---

## AI Agent Design

### Claude Configuration

- **Model:** claude-sonnet-4-6 (fast, capable for tool use)
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
- Agent wallet balance (warns if below $50 AlphaUSD)
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
      agent/route.ts          # AI agent (MPP client + Claude), streams chat text
      events/route.ts         # SSE endpoint for payment events (right panel)
      session/
        reset/route.ts        # Reset session state
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
    mpp-server.ts             # MPP server setup (DoorDash side)
    mpp-client.ts             # MPP client setup (agent side)
    agent.ts                  # Claude agent logic with tools
    tempo.ts                  # Tempo wallet/chain config via viem
    session-store.ts          # In-memory session state + event emitter
  types/
    index.ts                  # Shared TypeScript types
```

---

## Environment Variables

```env
# AI
ANTHROPIC_API_KEY=sk-ant-...

# Tempo Wallets (testnet only -- never use mainnet keys)
AGENT_PRIVATE_KEY=0x...
DOORDASH_PRIVATE_KEY=0x...

# Tempo Network
TEMPO_RPC_URL=https://rpc.moderato.tempo.xyz

# Optional: override for local development
NEXT_PUBLIC_APP_URL=http://localhost:3000
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
  "@anthropic-ai/sdk": "latest"
}
```

`viem` 2.43.0+ includes Tempo chain support via `viem/tempo`, so a separate `tempo.ts` package is not needed for chain interaction. The `mppx` package provides both client and server MPP functionality. If during implementation we find that `mppx` re-exports or depends on `tempo.ts` internally, we will not add it as a direct dependency unless required for APIs not available through `viem/tempo`.
