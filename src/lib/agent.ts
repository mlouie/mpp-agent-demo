/**
 * AI Agent Orchestration (Claude + MPP)
 *
 * This module demonstrates how an AI agent uses MPP-gated APIs:
 * 1. Claude (via tool-use) decides which API to call
 * 2. The agent executes the call using mppFetch (MPP-aware fetch)
 * 3. mppFetch automatically handles the 402 challenge -> pay -> retry flow
 * 4. Claude receives the data and continues reasoning
 *
 * Production note: This pattern works for any AI agent framework, not just Claude.
 */
import Anthropic from "@anthropic-ai/sdk";
import { mppFetch } from "@/lib/mpp-client";
import type { ChatMessage, AgentStreamEvent } from "@/types";

/** Callback type for streaming agent events to the caller */
export type StreamCallback = (event: AgentStreamEvent) => void;

const anthropic = new Anthropic();

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * System prompt that guides Claude to behave as a helpful food ordering agent.
 * Instructs it to use tools thoroughly before making recommendations.
 */
const SYSTEM_PROMPT = `You are a helpful food ordering assistant. Follow these guidelines:

1. Always search restaurants first before making any recommendations.
2. Browse menus for 2-3 restaurants to compare options.
3. Recommend specific items with their prices so the user can make an informed choice.
4. Always confirm with the user before placing an order.
5. Be thorough in your research but concise in your responses.

You have access to tools to search restaurants, view menus, and place orders. Use them proactively.`;

/**
 * Anthropic tool definitions for the food ordering domain.
 * These map 1:1 to the MPP-gated API routes in /api/.
 */
const tools: Anthropic.Tool[] = [
  {
    name: "search_restaurants",
    description: "Search for available restaurants, optionally filtering by cuisine type and price range.",
    input_schema: {
      type: "object" as const,
      properties: {
        cuisine: {
          type: "string",
          description: "Optional cuisine type to filter by (e.g. 'Italian', 'Japanese', 'Mexican').",
        },
        priceRange: {
          type: "string",
          enum: ["$", "$$", "$$$"],
          description: "Optional price range filter: $ (budget), $$ (mid-range), $$$ (upscale).",
        },
      },
      required: [],
    },
  },
  {
    name: "get_menu",
    description: "Retrieve the full menu for a specific restaurant by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        restaurantId: {
          type: "string",
          description: "The unique identifier of the restaurant.",
        },
      },
      required: ["restaurantId"],
    },
  },
  {
    name: "place_order",
    description: "Place an order at a restaurant with specified menu items.",
    input_schema: {
      type: "object" as const,
      properties: {
        restaurantId: {
          type: "string",
          description: "The unique identifier of the restaurant to order from.",
        },
        itemIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of menu item IDs to include in the order.",
        },
      },
      required: ["restaurantId", "itemIds"],
    },
  },
];

/**
 * Executes a tool call by mapping it to the appropriate MPP-gated HTTP endpoint.
 * mppFetch automatically handles any 402 Payment Required challenges.
 *
 * @param toolName - Name of the tool to execute
 * @param toolInput - Parameters for the tool call
 * @returns Object containing the result string and cost of the API call
 */
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<{ result: string; cost: number }> {
  if (toolName === "search_restaurants") {
    const params = new URLSearchParams();
    if (toolInput.cuisine) params.set("cuisine", String(toolInput.cuisine));
    if (toolInput.priceRange) params.set("priceRange", String(toolInput.priceRange));

    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await mppFetch(`${BASE_URL}/api/restaurants${query}`);
    const data = await response.json();
    return { result: JSON.stringify(data), cost: 0.01 };
  }

  if (toolName === "get_menu") {
    const restaurantId = String(toolInput.restaurantId);
    const response = await mppFetch(`${BASE_URL}/api/menu/${restaurantId}`);
    const data = await response.json();
    return { result: JSON.stringify(data), cost: 0.01 };
  }

  if (toolName === "place_order") {
    const response = await mppFetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: toolInput.restaurantId,
        itemIds: toolInput.itemIds,
      }),
    });
    const data = await response.json();
    const cost = typeof data.total === "number" ? data.total : 0;
    return { result: JSON.stringify(data), cost };
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

/**
 * Runs the agentic loop: repeatedly calls Claude, processes tool use blocks,
 * executes tools, and feeds results back until Claude produces a final response.
 *
 * Events are emitted via onEvent for streaming to the frontend as NDJSON.
 *
 * @param messages - Conversation history as ChatMessage[]
 * @param onEvent - Callback to stream AgentStreamEvents to the caller
 */
export async function runAgent(
  messages: ChatMessage[],
  onEvent: StreamCallback
): Promise<void> {
  // Convert ChatMessage[] to Anthropic MessageParam[]
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop: continue until Claude stops requesting tool use
  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages: anthropicMessages,
    });

    // Process each content block in the response
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        onEvent({ type: "text", content: block.text });
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    // If no tool use, Claude is done
    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
      break;
    }

    // Execute all tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const params = toolUse.input as Record<string, unknown>;

      onEvent({ type: "tool_start", tool: toolUse.name, params });

      try {
        const { result, cost } = await executeTool(toolUse.name, params);
        onEvent({ type: "tool_end", tool: toolUse.name, cost });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onEvent({ type: "error", message: `Tool ${toolUse.name} failed: ${message}` });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Error: ${message}`,
          is_error: true,
        });
      }
    }

    // Append the assistant turn (with tool use blocks) and tool results to the history
    anthropicMessages.push({ role: "assistant", content: response.content });
    anthropicMessages.push({ role: "user", content: toolResults });
  }

  onEvent({ type: "done" });
}
