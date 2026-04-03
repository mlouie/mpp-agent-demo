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
