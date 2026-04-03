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

      if (!response.ok || !response.body) throw new Error(`Agent request failed: ${response.status}`);

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
                  updated.push({ role: "assistant", content: assistantText, toolCalls: [...toolCalls] });
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
                if (lastMsg?.role === "assistant") lastMsg.toolCalls = [...toolCalls];
                return updated;
              });
              break;
            case "error":
              assistantText += `\n\nError: ${event.message}`;
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg?.role === "assistant") lastMsg.content = assistantText;
                else updated.push({ role: "assistant", content: assistantText });
                return updated;
              });
              break;
            case "done":
              break;
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Sorry, something went wrong: ${(e as Error).message}` }]);
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
