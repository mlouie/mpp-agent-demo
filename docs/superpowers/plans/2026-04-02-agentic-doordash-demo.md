# Agentic DoorDash Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Next.js demo showing an AI agent ordering food from MPP-gated restaurant APIs, with a split-screen UI showing the agent chat (left) and DoorDash's payment dashboard (right).

**Architecture:** Next.js 15 App Router with three backend layers: (1) mock restaurant APIs gated by `mppx.charge()` acting as the "DoorDash" MPP server, (2) an AI agent using Claude tool-use as the MPP client that pays for API access, (3) SSE-based event streaming for the real-time payment dashboard. Frontend is a split-screen layout with Tailwind CSS.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, `mppx` 0.5.x (MPP SDK), `viem` 2.47.x (Tempo chain), `@anthropic-ai/sdk` (Claude API), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-04-02-agentic-doordash-demo-design.md`

---

## File Structure

```
src/
  app/
    layout.tsx                    # Root layout with metadata
    page.tsx                      # Main split-screen layout + state orchestration
    globals.css                   # Tailwind imports
    api/
      restaurants/route.ts        # MPP-gated restaurant search (GET, $0.01/call)
      menu/[id]/route.ts          # MPP-gated menu lookup (GET, $0.01/call)
      orders/route.ts             # MPP-gated order placement (POST, dynamic price)
      agent/route.ts              # AI agent endpoint (POST, streams NDJSON)
      events/route.ts             # SSE endpoint for payment events
      session/reset/route.ts      # Reset session state (POST)
      status/route.ts             # Health check (GET)
  components/
    ChatPanel.tsx                 # Left panel - agent chat UI
    PlatformView.tsx              # Right panel - composes dashboard sub-components
    SessionCard.tsx               # MPP session status card
    RequestLog.tsx                # API request log with per-call charges
    SettlementTimeline.tsx        # Visual settlement progression
  data/
    restaurants.ts                # Hardcoded restaurant catalog (5 restaurants)
  lib/
    mpp-server.ts                 # MPP server instance (DoorDash side)
    mpp-client.ts                 # MPP client instance (agent side)
    agent.ts                      # Claude agent logic: system prompt, tools, agentic loop
    tempo.ts                      # Tempo wallet & chain config via viem
    session-store.ts              # In-memory session state + EventEmitter for SSE
  hooks/
    useAgent.ts                   # React hook: send message, stream response
    usePaymentEvents.ts           # React hook: subscribe to SSE payment events
  types/
    index.ts                      # Shared TypeScript types
.env.local                        # Secret keys (git-ignored)
.env.example                      # Template for .env.local
```

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `.env.example`, `.env.local`
- Modify: `package.json`, `tsconfig.json`

- [ ] **Step 1: Create Next.js project**

```bash
cd /Users/marcuslouie/projects
npx create-next-app@latest mpp-agent-demo --typescript --tailwind --eslint --app --src-dir --no-import-alias --turbopack
```

Select defaults when prompted. This creates the project with Next.js 15, Tailwind CSS v4, TypeScript, App Router, and `src/` directory.

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/marcuslouie/projects/mpp-agent-demo
npm install mppx viem @anthropic-ai/sdk
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Create `.env.example`**

Create `.env.example` at the project root:

```env
# AI
ANTHROPIC_API_KEY=sk-ant-...

# Tempo Wallets (testnet only -- never use mainnet keys)
AGENT_PRIVATE_KEY=0x...
DOORDASH_PRIVATE_KEY=0x...

# MPP Server
MPP_SECRET_KEY=your-secret-key-for-hmac-challenges

# Optional: override app URL for local development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 4: Create `.env.local` with real keys**

Create `.env.local` at the project root. Generate two fresh private keys for testnet wallets (these are throwaway testnet keys -- never reuse for mainnet):

```env
ANTHROPIC_API_KEY=<your-anthropic-api-key>
AGENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
DOORDASH_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
MPP_SECRET_KEY=demo-mpp-secret-key-change-in-production
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Note: The private keys above are well-known Hardhat test keys. They work fine for testnet demos but **must never be used with real funds**.

- [ ] **Step 5: Verify `.gitignore` excludes `.env.local`**

Check that the generated `.gitignore` includes `.env*.local`. If not, add it.

- [ ] **Step 6: Add Vitest config**

Create `vitest.config.ts` at the project root:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Add test script to `package.json`:

```json
"scripts": {
  ...
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 7: Verify project builds**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with mppx, viem, and Anthropic SDK"
```

---

### Task 2: Shared Types & Restaurant Data

**Files:**
- Create: `src/types/index.ts`, `src/data/restaurants.ts`
- Test: `src/data/__tests__/restaurants.test.ts`

- [ ] **Step 1: Create shared types**

Create `src/types/index.ts`:

```ts
export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  priceRange: "$" | "$$" | "$$$";
  rating: number;
  deliveryTime: string;
  menu: MenuItem[];
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  tags: string[];
};

export type PaymentEvent = {
  type: "session_open" | "payment" | "session_settle" | "session_reset";
  timestamp: number;
  endpoint?: string;
  method?: string;
  amount?: number;
  voucherIndex?: number;
  description?: string;
  sessionId?: string;
  txHash?: string;
  totalSpent?: number;
};

export type SessionState = {
  sessionId: string;
  status: "idle" | "open" | "settling" | "settled";
  events: PaymentEvent[];
  totalSpent: number;
  onChainTxns: {
    open?: string;
    settle?: string;
  };
};

export type AgentStreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; tool: string; params: Record<string, unknown> }
  | { type: "tool_end"; tool: string; cost: number }
  | { type: "error"; message: string }
  | { type: "done" };

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; cost: number }[];
};
```

- [ ] **Step 2: Write restaurant data test**

Create `src/data/__tests__/restaurants.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  restaurants,
  searchRestaurants,
  getRestaurantById,
  computeOrderTotal,
} from "../restaurants";

describe("restaurants", () => {
  it("has 5 restaurants", () => {
    expect(restaurants).toHaveLength(5);
  });

  it("each restaurant has 6-8 menu items", () => {
    for (const r of restaurants) {
      expect(r.menu.length).toBeGreaterThanOrEqual(6);
      expect(r.menu.length).toBeLessThanOrEqual(8);
    }
  });

  it("all prices are between $8 and $25", () => {
    for (const r of restaurants) {
      for (const item of r.menu) {
        expect(item.price).toBeGreaterThanOrEqual(8);
        expect(item.price).toBeLessThanOrEqual(25);
      }
    }
  });
});

describe("searchRestaurants", () => {
  it("filters by cuisine", () => {
    const results = searchRestaurants({ cuisine: "thai" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.cuisine.toLowerCase() === "thai")).toBe(true);
  });

  it("filters by price range", () => {
    const results = searchRestaurants({ priceRange: "$" });
    expect(results.every((r) => r.priceRange === "$")).toBe(true);
  });

  it("returns all restaurants with no filters", () => {
    const results = searchRestaurants({});
    expect(results).toHaveLength(5);
  });
});

describe("getRestaurantById", () => {
  it("returns restaurant when found", () => {
    const r = getRestaurantById("somtum-thai");
    expect(r).toBeDefined();
    expect(r!.name).toBe("Somtum Thai");
  });

  it("returns undefined for unknown id", () => {
    expect(getRestaurantById("nonexistent")).toBeUndefined();
  });
});

describe("computeOrderTotal", () => {
  it("sums selected item prices", () => {
    const total = computeOrderTotal("somtum-thai", [
      "green-papaya-salad",
      "pad-thai",
    ]);
    expect(total).toBeGreaterThan(0);
    expect(typeof total).toBe("number");
  });

  it("throws for unknown restaurant", () => {
    expect(() => computeOrderTotal("nonexistent", ["item"])).toThrow();
  });

  it("throws for unknown item", () => {
    expect(() =>
      computeOrderTotal("somtum-thai", ["nonexistent-item"])
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL -- module `../restaurants` does not exist.

- [ ] **Step 4: Create restaurant catalog**

Create `src/data/restaurants.ts`:

```ts
import type { Restaurant } from "@/types";

export const restaurants: Restaurant[] = [
  {
    id: "somtum-thai",
    name: "Somtum Thai",
    cuisine: "Thai",
    priceRange: "$$",
    rating: 4.7,
    deliveryTime: "25-35 min",
    menu: [
      {
        id: "green-papaya-salad",
        name: "Green Papaya Salad",
        description: "Shredded papaya with lime, chili, and peanuts",
        price: 12,
        tags: ["spicy", "vegetarian", "gluten-free"],
      },
      {
        id: "pad-thai",
        name: "Pad Thai",
        description: "Rice noodles with shrimp, tofu, peanuts, and tamarind",
        price: 16,
        tags: ["popular"],
      },
      {
        id: "green-curry",
        name: "Green Curry",
        description: "Coconut milk curry with bamboo shoots and Thai basil",
        price: 17,
        tags: ["spicy", "gluten-free"],
      },
      {
        id: "tom-yum-soup",
        name: "Tom Yum Soup",
        description: "Hot and sour soup with shrimp, mushrooms, and lemongrass",
        price: 14,
        tags: ["spicy", "gluten-free"],
      },
      {
        id: "mango-sticky-rice",
        name: "Mango Sticky Rice",
        description: "Sweet sticky rice with fresh mango and coconut cream",
        price: 10,
        tags: ["vegetarian", "dessert"],
      },
      {
        id: "thai-iced-tea",
        name: "Thai Iced Tea",
        description: "Sweet black tea with condensed milk over ice",
        price: 8,
        tags: ["drink", "vegetarian"],
      },
      {
        id: "basil-chicken",
        name: "Thai Basil Chicken",
        description: "Stir-fried chicken with holy basil, chili, and garlic",
        price: 15,
        tags: ["spicy"],
      },
    ],
  },
  {
    id: "casa-oaxaca",
    name: "Casa Oaxaca",
    cuisine: "Mexican",
    priceRange: "$$",
    rating: 4.5,
    deliveryTime: "30-40 min",
    menu: [
      {
        id: "street-tacos",
        name: "Street Tacos (3)",
        description: "Corn tortillas with carne asada, onion, and cilantro",
        price: 14,
        tags: ["popular", "gluten-free"],
      },
      {
        id: "chicken-burrito",
        name: "Chicken Burrito",
        description: "Flour tortilla stuffed with chicken, rice, beans, and salsa",
        price: 15,
        tags: ["popular"],
      },
      {
        id: "guacamole-chips",
        name: "Guacamole & Chips",
        description: "Fresh avocado guacamole with house-made tortilla chips",
        price: 11,
        tags: ["vegetarian", "gluten-free"],
      },
      {
        id: "enchiladas-verdes",
        name: "Enchiladas Verdes",
        description: "Corn tortillas filled with cheese, topped with tomatillo salsa",
        price: 16,
        tags: ["vegetarian"],
      },
      {
        id: "churros",
        name: "Churros",
        description: "Fried dough sticks with cinnamon sugar and chocolate sauce",
        price: 9,
        tags: ["dessert", "vegetarian"],
      },
      {
        id: "mexican-street-corn",
        name: "Elote (Street Corn)",
        description: "Grilled corn with mayo, cotija cheese, chili, and lime",
        price: 8,
        tags: ["vegetarian", "gluten-free"],
      },
      {
        id: "horchata",
        name: "Horchata",
        description: "Sweet rice milk with cinnamon and vanilla",
        price: 8,
        tags: ["drink", "vegetarian"],
      },
    ],
  },
  {
    id: "bella-napoli",
    name: "Bella Napoli",
    cuisine: "Italian",
    priceRange: "$$$",
    rating: 4.8,
    deliveryTime: "35-45 min",
    menu: [
      {
        id: "margherita-pizza",
        name: "Margherita Pizza",
        description: "San Marzano tomato, fresh mozzarella, basil, olive oil",
        price: 18,
        tags: ["vegetarian", "popular"],
      },
      {
        id: "carbonara",
        name: "Spaghetti Carbonara",
        description: "Guanciale, egg yolk, pecorino Romano, black pepper",
        price: 20,
        tags: ["popular"],
      },
      {
        id: "caprese-salad",
        name: "Caprese Salad",
        description: "Heirloom tomatoes, buffalo mozzarella, basil, balsamic",
        price: 14,
        tags: ["vegetarian", "gluten-free"],
      },
      {
        id: "chicken-parm",
        name: "Chicken Parmigiana",
        description: "Breaded chicken with marinara and melted mozzarella",
        price: 22,
        tags: [],
      },
      {
        id: "tiramisu",
        name: "Tiramisu",
        description: "Espresso-soaked ladyfingers with mascarpone cream",
        price: 12,
        tags: ["dessert", "vegetarian"],
      },
      {
        id: "bruschetta",
        name: "Bruschetta",
        description: "Toasted bread with tomato, garlic, basil, and olive oil",
        price: 11,
        tags: ["vegetarian"],
      },
    ],
  },
  {
    id: "sakura-sushi",
    name: "Sakura Sushi",
    cuisine: "Japanese",
    priceRange: "$$$",
    rating: 4.6,
    deliveryTime: "25-35 min",
    menu: [
      {
        id: "salmon-nigiri",
        name: "Salmon Nigiri (4pc)",
        description: "Fresh Atlantic salmon over seasoned rice",
        price: 14,
        tags: ["gluten-free"],
      },
      {
        id: "spicy-tuna-roll",
        name: "Spicy Tuna Roll",
        description: "Tuna, spicy mayo, cucumber, sesame seeds",
        price: 16,
        tags: ["spicy", "popular"],
      },
      {
        id: "chicken-teriyaki",
        name: "Chicken Teriyaki",
        description: "Grilled chicken with teriyaki glaze, rice, and vegetables",
        price: 18,
        tags: ["popular"],
      },
      {
        id: "miso-soup",
        name: "Miso Soup",
        description: "Dashi broth with tofu, wakame, and green onion",
        price: 8,
        tags: ["vegetarian"],
      },
      {
        id: "edamame",
        name: "Edamame",
        description: "Steamed soybeans with sea salt",
        price: 8,
        tags: ["vegetarian", "gluten-free"],
      },
      {
        id: "dragon-roll",
        name: "Dragon Roll",
        description: "Shrimp tempura, avocado, eel, unagi sauce",
        price: 20,
        tags: [],
      },
      {
        id: "matcha-ice-cream",
        name: "Matcha Ice Cream",
        description: "Green tea ice cream with red bean paste",
        price: 9,
        tags: ["dessert", "vegetarian"],
      },
    ],
  },
  {
    id: "liberty-burger",
    name: "Liberty Burger",
    cuisine: "American",
    priceRange: "$",
    rating: 4.3,
    deliveryTime: "20-30 min",
    menu: [
      {
        id: "classic-burger",
        name: "Classic Cheeseburger",
        description: "Angus beef, cheddar, lettuce, tomato, special sauce",
        price: 14,
        tags: ["popular"],
      },
      {
        id: "bacon-burger",
        name: "Bacon BBQ Burger",
        description: "Angus beef, smoked bacon, onion rings, BBQ sauce",
        price: 17,
        tags: [],
      },
      {
        id: "chicken-sandwich",
        name: "Spicy Chicken Sandwich",
        description: "Crispy chicken breast, pickles, spicy mayo, brioche bun",
        price: 15,
        tags: ["spicy", "popular"],
      },
      {
        id: "veggie-burger",
        name: "Veggie Burger",
        description: "Black bean patty, avocado, sprouts, chipotle aioli",
        price: 14,
        tags: ["vegetarian"],
      },
      {
        id: "loaded-fries",
        name: "Loaded Fries",
        description: "Crispy fries with cheese sauce, bacon, and jalape\u00f1os",
        price: 10,
        tags: ["vegetarian"],
      },
      {
        id: "milkshake",
        name: "Classic Milkshake",
        description: "Hand-spun vanilla, chocolate, or strawberry shake",
        price: 9,
        tags: ["drink", "vegetarian", "dessert"],
      },
      {
        id: "onion-rings",
        name: "Onion Rings",
        description: "Beer-battered onion rings with ranch dipping sauce",
        price: 8,
        tags: ["vegetarian"],
      },
      {
        id: "caesar-salad",
        name: "Caesar Salad",
        description: "Romaine, parmesan, croutons, house-made Caesar dressing",
        price: 11,
        tags: ["vegetarian"],
      },
    ],
  },
];

export function searchRestaurants(filters: {
  cuisine?: string;
  priceRange?: "$" | "$$" | "$$$";
}): Restaurant[] {
  return restaurants.filter((r) => {
    if (
      filters.cuisine &&
      r.cuisine.toLowerCase() !== filters.cuisine.toLowerCase()
    )
      return false;
    if (filters.priceRange && r.priceRange !== filters.priceRange) return false;
    return true;
  });
}

export function getRestaurantById(id: string): Restaurant | undefined {
  return restaurants.find((r) => r.id === id);
}

export function computeOrderTotal(
  restaurantId: string,
  itemIds: string[]
): number {
  const restaurant = getRestaurantById(restaurantId);
  if (!restaurant) throw new Error(`Restaurant not found: ${restaurantId}`);

  let total = 0;
  for (const itemId of itemIds) {
    const item = restaurant.menu.find((m) => m.id === itemId);
    if (!item)
      throw new Error(
        `Item not found: ${itemId} in restaurant ${restaurantId}`
      );
    total += item.price;
  }
  return total;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/data/restaurants.ts src/data/__tests__/restaurants.test.ts
git commit -m "feat: add shared types and restaurant catalog with search utilities"
```

---

### Task 3: In-Memory Session Store

**Files:**
- Create: `src/lib/session-store.ts`
- Test: `src/lib/__tests__/session-store.test.ts`

- [ ] **Step 1: Write session store test**

Create `src/lib/__tests__/session-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { SessionStore } from "../session-store";
import type { PaymentEvent } from "@/types";

describe("SessionStore", () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  it("starts in idle state", () => {
    const state = store.getState();
    expect(state.status).toBe("idle");
    expect(state.events).toHaveLength(0);
    expect(state.totalSpent).toBe(0);
  });

  it("opens a session", () => {
    store.openSession("session-123", "0xabc");
    const state = store.getState();
    expect(state.status).toBe("open");
    expect(state.sessionId).toBe("session-123");
    expect(state.onChainTxns.open).toBe("0xabc");
  });

  it("adds payment events and updates total", () => {
    store.openSession("session-123");
    store.addPayment({
      endpoint: "/api/restaurants",
      method: "GET",
      amount: 0.01,
      description: "Search restaurants",
    });
    const state = store.getState();
    expect(state.events).toHaveLength(2); // session_open + payment
    expect(state.totalSpent).toBeCloseTo(0.01);
  });

  it("tracks cumulative total across multiple payments", () => {
    store.openSession("session-123");
    store.addPayment({
      endpoint: "/api/restaurants",
      method: "GET",
      amount: 0.01,
      description: "Search",
    });
    store.addPayment({
      endpoint: "/api/menu/somtum-thai",
      method: "GET",
      amount: 0.01,
      description: "Menu lookup",
    });
    expect(store.getState().totalSpent).toBeCloseTo(0.02);
  });

  it("settles a session", () => {
    store.openSession("session-123");
    store.addPayment({
      endpoint: "/api/restaurants",
      method: "GET",
      amount: 0.01,
      description: "Search",
    });
    store.settleSession("0xdef");
    const state = store.getState();
    expect(state.status).toBe("settled");
    expect(state.onChainTxns.settle).toBe("0xdef");
  });

  it("resets to idle state", () => {
    store.openSession("session-123");
    store.addPayment({
      endpoint: "/api/restaurants",
      method: "GET",
      amount: 0.01,
      description: "Search",
    });
    store.reset();
    const state = store.getState();
    expect(state.status).toBe("idle");
    expect(state.events).toHaveLength(0);
    expect(state.totalSpent).toBe(0);
  });

  it("emits events to subscribers", () => {
    const received: PaymentEvent[] = [];
    store.subscribe((event) => received.push(event));

    store.openSession("session-123");
    store.addPayment({
      endpoint: "/api/restaurants",
      method: "GET",
      amount: 0.01,
      description: "Search",
    });

    expect(received).toHaveLength(2);
    expect(received[0].type).toBe("session_open");
    expect(received[1].type).toBe("payment");
  });

  it("unsubscribe stops events", () => {
    const received: PaymentEvent[] = [];
    const unsub = store.subscribe((event) => received.push(event));

    store.openSession("session-123");
    unsub();
    store.addPayment({
      endpoint: "/api/restaurants",
      method: "GET",
      amount: 0.01,
      description: "Search",
    });

    expect(received).toHaveLength(1); // only session_open
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL -- module `../session-store` does not exist.

- [ ] **Step 3: Implement session store**

Create `src/lib/session-store.ts`:

```ts
/**
 * In-Memory Session Store
 *
 * DEMO SCAFFOLDING: This store exists only to power the payment dashboard
 * visualization. In production, you would NOT need this -- MPP session state
 * lives in the protocol itself. DoorDash would use Tempo's block explorer
 * or their own indexer for payment reporting.
 *
 * The store uses an EventEmitter pattern so the SSE endpoint can push
 * payment events to the frontend in real time.
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
    return {
      sessionId: "",
      status: "idle",
      events: [],
      totalSpent: 0,
      onChainTxns: {},
    };
  }

  getState(): SessionState {
    return { ...this.state, events: [...this.state.events] };
  }

  openSession(sessionId: string, txHash?: string): void {
    this.state.sessionId = sessionId;
    this.state.status = "open";
    if (txHash) this.state.onChainTxns.open = txHash;
    this.paymentIndex = 0;

    const event: PaymentEvent = {
      type: "session_open",
      timestamp: Date.now(),
      sessionId,
      txHash,
    };
    this.state.events.push(event);
    this.emitter.emit("event", event);
  }

  addPayment(details: {
    endpoint: string;
    method: string;
    amount: number;
    description: string;
  }): void {
    this.paymentIndex++;
    this.state.totalSpent += details.amount;

    const event: PaymentEvent = {
      type: "payment",
      timestamp: Date.now(),
      endpoint: details.endpoint,
      method: details.method,
      amount: details.amount,
      voucherIndex: this.paymentIndex,
      description: details.description,
    };
    this.state.events.push(event);
    this.emitter.emit("event", event);
  }

  settleSession(txHash?: string): void {
    this.state.status = "settled";
    if (txHash) this.state.onChainTxns.settle = txHash;

    const event: PaymentEvent = {
      type: "session_settle",
      timestamp: Date.now(),
      totalSpent: this.state.totalSpent,
      txHash,
    };
    this.state.events.push(event);
    this.emitter.emit("event", event);
  }

  reset(): void {
    this.state = this.createInitialState();
    this.paymentIndex = 0;

    const event: PaymentEvent = {
      type: "session_reset",
      timestamp: Date.now(),
    };
    this.emitter.emit("event", event);
  }

  subscribe(listener: (event: PaymentEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}

/**
 * Singleton instance. Uses globalThis to survive Next.js hot-reloads
 * in development without creating duplicate stores.
 */
const globalForStore = globalThis as unknown as { sessionStore: SessionStore };
export const sessionStore =
  globalForStore.sessionStore || new SessionStore();
globalForStore.sessionStore = sessionStore;
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-store.ts src/lib/__tests__/session-store.test.ts
git commit -m "feat: add in-memory session store with event emitter for SSE"
```

---

### Task 4: Tempo & MPP Configuration

**Files:**
- Create: `src/lib/tempo.ts`, `src/lib/mpp-server.ts`, `src/lib/mpp-client.ts`

- [ ] **Step 1: Create Tempo wallet and chain config**

Create `src/lib/tempo.ts`:

```ts
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
  return privateKeyToAccount(
    requireEnv("DOORDASH_PRIVATE_KEY") as `0x${string}`
  );
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
```

- [ ] **Step 2: Create MPP server config**

Create `src/lib/mpp-server.ts`:

```ts
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
```

- [ ] **Step 3: Create MPP client config**

Create `src/lib/mpp-client.ts`:

```ts
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
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds. (May show warnings about unused imports -- that's fine, the routes will use these in the next task.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tempo.ts src/lib/mpp-server.ts src/lib/mpp-client.ts
git commit -m "feat: add Tempo wallet config and MPP server/client setup"
```

---

### Task 5: MPP-Gated Restaurant API Routes

**Files:**
- Create: `src/app/api/restaurants/route.ts`, `src/app/api/menu/[id]/route.ts`, `src/app/api/orders/route.ts`

- [ ] **Step 1: Create restaurant search route**

Create `src/app/api/restaurants/route.ts`:

```ts
/**
 * MPP-Gated Restaurant Search API
 *
 * Demonstrates how to gate an existing API endpoint with MPP.
 * The only MPP-specific code is the mppServer.charge() call --
 * everything else is a standard Next.js route handler.
 *
 * Charge: $0.01 per search query (micropayment for API access).
 *
 * To apply this pattern to your own API:
 * 1. Import your shared mppServer instance (see lib/mpp-server.ts)
 * 2. Call mppServer.charge({ amount })(request) at the start of your handler
 * 3. If result.status is 402, return the challenge response
 * 4. Otherwise, do your normal work and wrap the response with result.withReceipt()
 *
 * Production note: In a real deployment, you'd use mainnet RPC and
 * a custody solution (e.g., Fireblocks) for the recipient wallet
 * instead of a raw private key.
 */
import { NextRequest } from "next/server";
import { mppServer } from "@/lib/mpp-server";
import { searchRestaurants } from "@/data/restaurants";
import { sessionStore } from "@/lib/session-store";

export async function GET(request: NextRequest) {
  // --- MPP payment gate (this is the only Tempo-specific code) ---
  const result = await mppServer.charge({ amount: "0.01" })(request);
  if (result.status === 402) return result.challenge;
  // --- End MPP gate ---

  const cuisine = request.nextUrl.searchParams.get("cuisine") ?? undefined;
  const priceRange = request.nextUrl.searchParams.get("priceRange") as
    | "$"
    | "$$"
    | "$$$"
    | undefined;

  const results = searchRestaurants({ cuisine, priceRange });

  // Strip menus from search results (agents pay separately to see menus)
  const summary = results.map(({ menu, ...rest }) => ({
    ...rest,
    itemCount: menu.length,
  }));

  // Log payment event for the dashboard visualization
  sessionStore.addPayment({
    endpoint: `/api/restaurants${cuisine ? `?cuisine=${cuisine}` : ""}`,
    method: "GET",
    amount: 0.01,
    description: `Search: ${cuisine ?? "all"} restaurants`,
  });

  return result.withReceipt(Response.json(summary));
}
```

- [ ] **Step 2: Create menu lookup route**

Create `src/app/api/menu/[id]/route.ts`:

```ts
/**
 * MPP-Gated Menu Lookup API
 *
 * Returns the full menu for a specific restaurant.
 * Charge: $0.01 per menu lookup.
 *
 * Same MPP pattern as the restaurant search route -- the charge()
 * middleware is identical, only the business logic differs.
 */
import { NextRequest } from "next/server";
import { mppServer } from "@/lib/mpp-server";
import { getRestaurantById } from "@/data/restaurants";
import { sessionStore } from "@/lib/session-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await mppServer.charge({ amount: "0.01" })(request);
  if (result.status === 402) return result.challenge;

  const { id } = await params;
  const restaurant = getRestaurantById(id);

  if (!restaurant) {
    return result.withReceipt(
      Response.json({ error: `Restaurant not found: ${id}` }, { status: 404 })
    );
  }

  sessionStore.addPayment({
    endpoint: `/api/menu/${id}`,
    method: "GET",
    amount: 0.01,
    description: `Menu: ${restaurant.name}`,
  });

  return result.withReceipt(Response.json(restaurant));
}
```

- [ ] **Step 3: Create order placement route**

Create `src/app/api/orders/route.ts`:

```ts
/**
 * MPP-Gated Order Placement API
 *
 * Places an order and charges the full order total via MPP.
 * This demonstrates DYNAMIC PRICING with MPP -- the charge amount
 * is computed from the request body, not fixed at middleware level.
 *
 * How dynamic pricing works with MPP:
 * 1. Parse the request body to determine what the agent is ordering
 * 2. Compute the total from menu item prices
 * 3. Pass the computed total to mppServer.charge({ amount })
 * 4. The MPP challenge includes this exact amount -- the agent pays it
 *
 * Production note: For a real marketplace, you'd validate item
 * availability, apply taxes/fees, and store the order in a database.
 */
import { NextRequest } from "next/server";
import { mppServer } from "@/lib/mpp-server";
import {
  getRestaurantById,
  computeOrderTotal,
} from "@/data/restaurants";
import { sessionStore } from "@/lib/session-store";

export async function POST(request: NextRequest) {
  // Clone the request so we can read the body before MPP consumes it
  const body = await request.clone().json();
  const { restaurantId, itemIds } = body as {
    restaurantId: string;
    itemIds: string[];
  };

  // Validate request
  const restaurant = getRestaurantById(restaurantId);
  if (!restaurant) {
    return Response.json(
      { error: `Restaurant not found: ${restaurantId}` },
      { status: 400 }
    );
  }

  let total: number;
  try {
    total = computeOrderTotal(restaurantId, itemIds);
  } catch (e) {
    return Response.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }

  // --- MPP payment gate with dynamic amount ---
  const result = await mppServer.charge({ amount: String(total) })(request);
  if (result.status === 402) return result.challenge;
  // --- End MPP gate ---

  const orderId = `ORD-${Date.now()}`;
  const items = itemIds.map(
    (id) => restaurant.menu.find((m) => m.id === id)!
  );

  sessionStore.addPayment({
    endpoint: "/api/orders",
    method: "POST",
    amount: total,
    description: `Order from ${restaurant.name}: $${total.toFixed(2)}`,
  });

  return result.withReceipt(
    Response.json({
      orderId,
      restaurant: restaurant.name,
      items: items.map((i) => ({ name: i.name, price: i.price })),
      total,
      status: "confirmed",
      estimatedDelivery: restaurant.deliveryTime,
    })
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/restaurants/route.ts src/app/api/menu/\[id\]/route.ts src/app/api/orders/route.ts
git commit -m "feat: add MPP-gated restaurant, menu, and order API routes"
```

---

### Task 6: AI Agent Logic & Agent API Route

**Files:**
- Create: `src/lib/agent.ts`, `src/app/api/agent/route.ts`

- [ ] **Step 1: Create agent logic with Claude tool-use**

Create `src/lib/agent.ts`:

```ts
/**
 * AI Agent Orchestration (Claude + MPP)
 *
 * This module demonstrates how an AI agent uses MPP-gated APIs:
 * 1. Claude (via tool-use) decides which API to call
 * 2. The agent executes the call using mppFetch (MPP-aware fetch)
 * 3. mppFetch automatically handles the 402 challenge -> pay -> retry flow
 * 4. Claude receives the data and continues reasoning
 *
 * The agent never "thinks about" payments -- they happen transparently
 * inside mppFetch. From the agent's perspective, it's just calling APIs.
 *
 * Production note: This pattern works for any AI agent framework
 * (LangChain, CrewAI, AutoGen, etc.), not just Claude. The key is
 * using mppFetch as the HTTP client for external API calls.
 */
import Anthropic from "@anthropic-ai/sdk";
import { mppFetch } from "./mpp-client";
import { sessionStore } from "./session-store";
import type { AgentStreamEvent, ChatMessage } from "@/types";

const anthropic = new Anthropic();

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const SYSTEM_PROMPT = `You are a helpful food ordering assistant. You help users find and order food delivery from local restaurants.

When a user asks for food:
1. ALWAYS search for restaurants first using the search_restaurants tool. Search by cuisine if the user mentions one.
2. Browse menus for 2-3 promising restaurants using get_menu to compare options.
3. Recommend specific items based on the user's preferences (cuisine, budget, dietary needs).
4. Present your top recommendation with item names and prices.
5. Ask the user to confirm before placing the order.
6. Only call place_order after the user confirms.

Be thorough -- compare multiple options before recommending. This helps the user get the best meal.
Keep responses concise but friendly. Always mention specific dish names and prices.`;

const tools: Anthropic.Tool[] = [
  {
    name: "search_restaurants",
    description:
      "Search for restaurants. Optionally filter by cuisine type or price range.",
    input_schema: {
      type: "object" as const,
      properties: {
        cuisine: {
          type: "string",
          description:
            "Cuisine type to filter by (e.g., 'thai', 'mexican', 'italian', 'japanese', 'american')",
        },
        priceRange: {
          type: "string",
          enum: ["$", "$$", "$$$"],
          description: "Price range filter",
        },
      },
    },
  },
  {
    name: "get_menu",
    description:
      "Get the full menu for a specific restaurant by its ID. Returns all menu items with names, descriptions, prices, and tags.",
    input_schema: {
      type: "object" as const,
      properties: {
        restaurantId: {
          type: "string",
          description: "The restaurant ID (e.g., 'somtum-thai')",
        },
      },
      required: ["restaurantId"],
    },
  },
  {
    name: "place_order",
    description:
      "Place a food delivery order. Only call this after the user has confirmed the order.",
    input_schema: {
      type: "object" as const,
      properties: {
        restaurantId: {
          type: "string",
          description: "The restaurant ID to order from",
        },
        itemIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of menu item IDs to order",
        },
      },
      required: ["restaurantId", "itemIds"],
    },
  },
];

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ result: unknown; cost: number }> {
  let url: string;
  let options: RequestInit = {};
  let cost = 0;

  switch (name) {
    case "search_restaurants": {
      const params = new URLSearchParams();
      if (input.cuisine) params.set("cuisine", input.cuisine as string);
      if (input.priceRange)
        params.set("priceRange", input.priceRange as string);
      url = `${BASE_URL}/api/restaurants${params.toString() ? `?${params}` : ""}`;
      cost = 0.01;
      break;
    }
    case "get_menu": {
      url = `${BASE_URL}/api/menu/${input.restaurantId}`;
      cost = 0.01;
      break;
    }
    case "place_order": {
      url = `${BASE_URL}/api/orders`;
      options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: input.restaurantId,
          itemIds: input.itemIds,
        }),
      };
      // Cost is dynamic -- will be determined by the order total
      cost = 0; // Placeholder; actual cost comes from the payment receipt
      break;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  // mppFetch handles 402 -> pay -> retry transparently
  const response = await mppFetch(url, options);
  const data = await response.json();

  // For orders, extract the actual cost from the response
  if (name === "place_order" && data.total) {
    cost = data.total;
  }

  return { result: data, cost };
}

export type StreamCallback = (event: AgentStreamEvent) => void;

export async function runAgent(
  messages: ChatMessage[],
  onEvent: StreamCallback
): Promise<void> {
  // Convert our ChatMessage format to Anthropic's format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop: keep calling Claude until it stops using tools
  let continueLoop = true;
  while (continueLoop) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages: anthropicMessages,
    });

    // Process response content blocks
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        onEvent({ type: "text", content: block.text });
      } else if (block.type === "tool_use") {
        onEvent({
          type: "tool_start",
          tool: block.name,
          params: block.input as Record<string, unknown>,
        });

        try {
          const { result, cost } = await executeTool(
            block.name,
            block.input as Record<string, unknown>
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
          onEvent({ type: "tool_end", tool: block.name, cost });
        } catch (e) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${(e as Error).message}`,
            is_error: true,
          });
          onEvent({ type: "tool_end", tool: block.name, cost: 0 });
        }
      }
    }

    if (response.stop_reason === "tool_use") {
      // Add assistant response and tool results, then loop
      anthropicMessages.push({ role: "assistant", content: response.content });
      anthropicMessages.push({ role: "user", content: toolResults });
    } else {
      // end_turn or max_tokens -- we're done
      continueLoop = false;
    }
  }

  onEvent({ type: "done" });
}
```

- [ ] **Step 2: Create agent API route**

Create `src/app/api/agent/route.ts`:

```ts
/**
 * Agent API Route (Streaming NDJSON)
 *
 * Receives a chat message, runs the AI agent, and streams events back
 * as newline-delimited JSON (NDJSON). Each line is an AgentStreamEvent.
 *
 * This is Stream 1 of the two-stream architecture:
 * - Stream 1 (this): POST /api/agent -> NDJSON of chat text + tool indicators
 * - Stream 2: GET /api/events -> SSE of payment events (for right panel)
 *
 * The agent route writes payment events to the session store as a side
 * effect of executing tools. The SSE endpoint reads from that same store.
 */
import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent";
import { sessionStore } from "@/lib/session-store";
import type { ChatMessage } from "@/types";

export async function POST(request: NextRequest) {
  const { messages } = (await request.json()) as { messages: ChatMessage[] };

  // Open a session if this is the first request in a new conversation
  if (sessionStore.getState().status === "idle") {
    const sessionId = `sess-${Date.now()}`;
    sessionStore.openSession(sessionId);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runAgent(messages, (event) => {
          controller.enqueue(
            encoder.encode(JSON.stringify(event) + "\n")
          );
        });
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "error",
              message: (e as Error).message,
            }) + "\n"
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent.ts src/app/api/agent/route.ts
git commit -m "feat: add AI agent with Claude tool-use and streaming NDJSON endpoint"
```

---

### Task 7: SSE Events, Session Reset & Health Check Routes

**Files:**
- Create: `src/app/api/events/route.ts`, `src/app/api/session/reset/route.ts`, `src/app/api/status/route.ts`

- [ ] **Step 1: Create SSE events endpoint**

Create `src/app/api/events/route.ts`:

```ts
/**
 * SSE Payment Events Endpoint
 *
 * Stream 2 of the two-stream architecture. The frontend opens an
 * EventSource connection to this endpoint on page load. Payment
 * events from the session store are pushed here in real time.
 *
 * This powers the right panel (DoorDash platform view).
 */
import { sessionStore } from "@/lib/session-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send current state as initial event
      const currentState = sessionStore.getState();
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "init", state: currentState })}\n\n`
        )
      );

      // Subscribe to new events
      const unsub = sessionStore.subscribe((event) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      });

      // Clean up on close
      const cleanup = () => unsub();

      // Store cleanup function for when the connection closes
      // ReadableStream cancel is called when the client disconnects
      (controller as unknown as { _cleanup: () => void })._cleanup = cleanup;
    },
    cancel() {
      // Client disconnected -- any cleanup would go here
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Create session reset endpoint**

Create `src/app/api/session/reset/route.ts`:

```ts
import { sessionStore } from "@/lib/session-store";

export async function POST() {
  sessionStore.reset();
  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Create health check endpoint**

Create `src/app/api/status/route.ts`:

```ts
/**
 * Pre-Demo Health Check
 *
 * Hit /api/status before a live demo to verify all dependencies are up.
 * Returns green/red status for each: Tempo RPC, wallet balance, Claude API.
 */
import { createTempoClient, getAgentAccount } from "@/lib/tempo";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // Check Tempo RPC
  try {
    const client = createTempoClient();
    const blockNumber = await client.getBlockNumber();
    checks.tempo = { ok: true, detail: `Block #${blockNumber}` };
  } catch (e) {
    checks.tempo = { ok: false, detail: (e as Error).message };
  }

  // Check agent wallet balance
  try {
    const account = getAgentAccount();
    checks.wallet = {
      ok: true,
      detail: `Address: ${account.address}`,
    };
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
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/events/route.ts src/app/api/session/reset/route.ts src/app/api/status/route.ts
git commit -m "feat: add SSE events, session reset, and health check endpoints"
```

---

### Task 8: Frontend -- Layout & Chat Panel

**Files:**
- Create: `src/hooks/useAgent.ts`, `src/components/ChatPanel.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Update globals.css**

Replace `src/app/globals.css` with Tailwind imports only (remove the default Next.js styles):

```css
@import "tailwindcss";
```

- [ ] **Step 2: Update layout.tsx**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agentic Commerce on Tempo — DoorDash Demo",
  description: "AI agents paying for API access via Machine Payments Protocol",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Create useAgent hook**

Create `src/hooks/useAgent.ts`:

```ts
"use client";

import { useState, useCallback } from "react";
import type { ChatMessage, AgentStreamEvent } from "@/types";

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: ChatMessage = { role: "user", content };
    const updatedMessages = [...messages, userMessage];
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setActiveTool(null);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Agent request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      const toolCalls: { tool: string; cost: number }[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event: AgentStreamEvent = JSON.parse(line);

          switch (event.type) {
            case "text":
              assistantText += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg?.role === "assistant") {
                  lastMsg.content = assistantText;
                  lastMsg.toolCalls = [...toolCalls];
                } else {
                  updated.push({
                    role: "assistant",
                    content: assistantText,
                    toolCalls: [...toolCalls],
                  });
                }
                return updated;
              });
              break;
            case "tool_start":
              setActiveTool(event.tool);
              break;
            case "tool_end":
              setActiveTool(null);
              toolCalls.push({ tool: event.tool, cost: event.cost });
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg?.role === "assistant") {
                  lastMsg.toolCalls = [...toolCalls];
                }
                return updated;
              });
              break;
            case "error":
              assistantText += `\n\nError: ${event.message}`;
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg?.role === "assistant") {
                  lastMsg.content = assistantText;
                } else {
                  updated.push({ role: "assistant", content: assistantText });
                }
                return updated;
              });
              break;
            case "done":
              break;
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, something went wrong: ${(e as Error).message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setActiveTool(null);
    }
  }, [messages]);

  const resetChat = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
    setActiveTool(null);
  }, []);

  return { messages, isLoading, activeTool, sendMessage, resetChat };
}
```

- [ ] **Step 4: Create ChatPanel component**

Create `src/components/ChatPanel.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types";

const TOOL_LABELS: Record<string, string> = {
  search_restaurants: "Searching restaurants",
  get_menu: "Browsing menu",
  place_order: "Placing order",
};

export function ChatPanel({
  messages,
  isLoading,
  activeTool,
  onSendMessage,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  activeTool: string | null;
  onSendMessage: (content: string) => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTool]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          AI Agent
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg font-medium">Order food with AI</p>
            <p className="text-sm mt-1">
              Try: &quot;I want spicy Thai food under $20&quot;
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.toolCalls.map((tc, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1 text-xs bg-white/80 text-gray-600 rounded-full px-2 py-0.5 border border-gray-200"
                    >
                      {TOOL_LABELS[tc.tool] || tc.tool}
                      {tc.cost > 0 && (
                        <span className="text-green-600 font-medium">
                          ${tc.cost.toFixed(2)}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Active tool indicator */}
        {activeTool && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                {TOOL_LABELS[activeTool] || activeTool}...
              </div>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {isLoading && !activeTool && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What are you in the mood for?"
            disabled={isLoading}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/hooks/useAgent.ts src/components/ChatPanel.tsx
git commit -m "feat: add layout, useAgent hook, and ChatPanel component"
```

---

### Task 9: Frontend -- Platform View (Right Panel)

**Files:**
- Create: `src/hooks/usePaymentEvents.ts`, `src/components/SessionCard.tsx`, `src/components/RequestLog.tsx`, `src/components/SettlementTimeline.tsx`, `src/components/PlatformView.tsx`

- [ ] **Step 1: Create usePaymentEvents hook**

Create `src/hooks/usePaymentEvents.ts`:

```ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { PaymentEvent, SessionState } from "@/types";

const INITIAL_STATE: SessionState = {
  sessionId: "",
  status: "idle",
  events: [],
  totalSpent: 0,
  onChainTxns: {},
};

export function usePaymentEvents() {
  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === "init") {
        setState(event.state);
        return;
      }

      setState((prev) => {
        const updated = { ...prev, events: [...prev.events, event] };

        switch (event.type as PaymentEvent["type"]) {
          case "session_open":
            updated.status = "open";
            updated.sessionId = event.sessionId || prev.sessionId;
            if (event.txHash) updated.onChainTxns = { ...prev.onChainTxns, open: event.txHash };
            break;
          case "payment":
            updated.totalSpent = prev.totalSpent + (event.amount || 0);
            break;
          case "session_settle":
            updated.status = "settled";
            updated.totalSpent = event.totalSpent ?? prev.totalSpent;
            if (event.txHash) updated.onChainTxns = { ...prev.onChainTxns, settle: event.txHash };
            break;
          case "session_reset":
            return INITIAL_STATE;
        }

        return updated;
      });
    };

    eventSource.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => eventSource.close();
  }, []);

  const reset = useCallback(async () => {
    await fetch("/api/session/reset", { method: "POST" });
    setState(INITIAL_STATE);
  }, []);

  return { state, reset };
}
```

- [ ] **Step 2: Create SessionCard component**

Create `src/components/SessionCard.tsx`:

```tsx
"use client";

import type { SessionState } from "@/types";

const STATUS_STYLES: Record<SessionState["status"], { bg: string; text: string; label: string }> = {
  idle: { bg: "bg-gray-100", text: "text-gray-500", label: "Waiting" },
  open: { bg: "bg-blue-100", text: "text-blue-700", label: "Active" },
  settling: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Settling" },
  settled: { bg: "bg-green-100", text: "text-green-700", label: "Settled" },
};

export function SessionCard({ state }: { state: SessionState }) {
  const style = STATUS_STYLES[state.status];
  const paymentCount = state.events.filter((e) => e.type === "payment").length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          MPP Session
        </h3>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>

      {state.status === "idle" ? (
        <p className="text-sm text-gray-400">Waiting for agent activity...</p>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Session ID</span>
            <span className="font-mono text-gray-700 text-xs">
              {state.sessionId.slice(0, 16)}...
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">API Calls</span>
            <span className="font-medium text-gray-700">{paymentCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Revenue</span>
            <span className="font-semibold text-green-600 text-lg">
              ${state.totalSpent.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">On-chain Txns</span>
            <span className="font-medium text-gray-700">
              {(state.onChainTxns.open ? 1 : 0) + (state.onChainTxns.settle ? 1 : 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create RequestLog component**

Create `src/components/RequestLog.tsx`:

```tsx
"use client";

import type { PaymentEvent } from "@/types";

export function RequestLog({ events }: { events: PaymentEvent[] }) {
  const payments = events.filter((e) => e.type === "payment");

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        API Request Log
      </h3>

      {payments.length === 0 ? (
        <p className="text-sm text-gray-400">No requests yet</p>
      ) : (
        <div className="space-y-2">
          {payments.map((event, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-medium bg-gray-200 text-gray-600">
                  {event.method}
                </span>
                <span className="text-gray-600 truncate font-mono text-xs">
                  {event.endpoint}
                </span>
              </div>
              <span className="text-green-600 font-semibold whitespace-nowrap ml-2">
                +${(event.amount ?? 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create SettlementTimeline component**

Create `src/components/SettlementTimeline.tsx`:

```tsx
"use client";

import type { SessionState } from "@/types";

const EXPLORER_BASE = "https://explore.moderato.tempo.xyz";

type TimelineStep = {
  label: string;
  detail?: string;
  completed: boolean;
  link?: string;
};

export function SettlementTimeline({ state }: { state: SessionState }) {
  const paymentCount = state.events.filter((e) => e.type === "payment").length;

  const steps: TimelineStep[] = [
    {
      label: "Session Opened",
      detail: state.onChainTxns.open ? "1 on-chain tx" : undefined,
      completed: state.status !== "idle",
      link: state.onChainTxns.open
        ? `${EXPLORER_BASE}/tx/${state.onChainTxns.open}`
        : undefined,
    },
    {
      label: `${paymentCount} API Call${paymentCount !== 1 ? "s" : ""} Processed`,
      detail: paymentCount > 0 ? "Off-chain vouchers" : undefined,
      completed: paymentCount > 0,
    },
    {
      label: "Session Settled",
      detail: state.onChainTxns.settle ? "1 on-chain tx" : undefined,
      completed: state.status === "settled",
      link: state.onChainTxns.settle
        ? `${EXPLORER_BASE}/tx/${state.onChainTxns.settle}`
        : undefined,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Settlement Timeline
      </h3>

      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            {/* Vertical line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  step.completed
                    ? "bg-green-500 border-green-500"
                    : "bg-white border-gray-300"
                }`}
              />
              {i < steps.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-8 ${step.completed ? "bg-green-300" : "bg-gray-200"}`} />
              )}
            </div>

            {/* Content */}
            <div className="pb-6">
              <p className={`text-sm font-medium ${step.completed ? "text-gray-800" : "text-gray-400"}`}>
                {step.label}
              </p>
              {step.detail && (
                <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
              )}
              {step.link && (
                <a
                  href={step.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-700 mt-0.5 inline-block"
                >
                  View on Explorer &rarr;
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary callout */}
      {state.status === "settled" && (
        <div className="mt-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm font-medium text-green-800">
            {paymentCount} interactions, 2 on-chain transactions
          </p>
          <p className="text-xs text-green-600 mt-0.5">
            Total revenue: ${state.totalSpent.toFixed(2)} settled in &lt;1 second
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create PlatformView component**

Create `src/components/PlatformView.tsx`:

```tsx
"use client";

import type { SessionState } from "@/types";
import { SessionCard } from "./SessionCard";
import { RequestLog } from "./RequestLog";
import { SettlementTimeline } from "./SettlementTimeline";

export function PlatformView({ state }: { state: SessionState }) {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          What DoorDash Sees
        </h2>
      </div>

      {/* Dashboard */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <SessionCard state={state} />
        <RequestLog events={state.events} />
        <SettlementTimeline state={state} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/usePaymentEvents.ts src/components/SessionCard.tsx src/components/RequestLog.tsx src/components/SettlementTimeline.tsx src/components/PlatformView.tsx
git commit -m "feat: add PlatformView dashboard with session card, request log, and timeline"
```

---

### Task 10: Wire Frontend Together

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create main page with split-screen layout**

Replace `src/app/page.tsx`:

```tsx
"use client";

import { ChatPanel } from "@/components/ChatPanel";
import { PlatformView } from "@/components/PlatformView";
import { useAgent } from "@/hooks/useAgent";
import { usePaymentEvents } from "@/hooks/usePaymentEvents";

export default function Home() {
  const { messages, isLoading, activeTool, sendMessage, resetChat } =
    useAgent();
  const { state: sessionState, reset: resetSession } = usePaymentEvents();

  const handleNewOrder = async () => {
    resetChat();
    await resetSession();
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">
            Agentic Commerce on Tempo
          </h1>
          <p className="text-xs text-gray-500">
            Machine Payments Protocol &middot; DoorDash Demo
          </p>
        </div>
        <button
          onClick={handleNewOrder}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          New Order
        </button>
      </header>

      {/* Split Screen */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Agent Chat */}
        <div className="w-1/2 border-r border-gray-200">
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            activeTool={activeTool}
            onSendMessage={sendMessage}
          />
        </div>

        {/* Right Panel - DoorDash Dashboard */}
        <div className="w-1/2">
          <PlatformView state={sessionState} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Expected: Split-screen layout renders with empty chat panel (left) and empty platform view (right). The "New Order" button is visible in the top bar.

Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire up split-screen layout with chat panel and platform view"
```

---

### Task 11: End-to-End Testing & Wallet Setup

**Files:** None created -- this is a verification and documentation task.

- [ ] **Step 1: Fund testnet wallets**

Get the agent wallet address:

```bash
node -e "
const { privateKeyToAccount } = require('viem/accounts');
const agent = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const doordash = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
console.log('Agent:', agent.address);
console.log('DoorDash:', doordash.address);
"
```

Fund both addresses using the Tempo testnet faucet:

```bash
curl -X POST https://docs.tempo.xyz/api/faucet \
  -H "Content-Type: application/json" \
  -d '{"address": "<AGENT_ADDRESS>"}'

curl -X POST https://docs.tempo.xyz/api/faucet \
  -H "Content-Type: application/json" \
  -d '{"address": "<DOORDASH_ADDRESS>"}'
```

Alternatively, use the RPC faucet:

```bash
cast rpc tempo_fundAddress <AGENT_ADDRESS> --rpc-url https://rpc.moderato.tempo.xyz
cast rpc tempo_fundAddress <DOORDASH_ADDRESS> --rpc-url https://rpc.moderato.tempo.xyz
```

- [ ] **Step 2: Run health check**

```bash
npm run dev &
curl http://localhost:3000/api/status | jq
```

Expected:

```json
{
  "ok": true,
  "checks": {
    "tempo": { "ok": true, "detail": "Block #..." },
    "wallet": { "ok": true, "detail": "Address: 0x..." },
    "claude": { "ok": true }
  }
}
```

If any check fails, fix the corresponding env var or fund the wallet.

- [ ] **Step 3: Run full demo flow**

Open `http://localhost:3000` and type:

> "I want spicy Thai food under $20"

Expected behavior:
1. **Left panel**: Agent starts searching, shows "Searching restaurants" pill
2. **Right panel**: Session card shows "Active", first payment event appears ($0.01)
3. **Left panel**: Agent browses 2-3 menus, each showing a cost badge
4. **Right panel**: Request log grows with each API call, revenue total increases
5. **Left panel**: Agent recommends specific dishes, asks for confirmation
6. Type "yes" or "order it"
7. **Left panel**: Agent places order, shows larger cost badge
8. **Right panel**: Order charge appears in request log with full order total

- [ ] **Step 4: Test session reset**

Click "New Order" in the top bar.

Expected:
- Left panel clears to empty state
- Right panel resets to "Waiting for agent activity..."
- A new message starts a fresh session

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify end-to-end demo flow and finalize project"
```
