"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types";

const TOOL_LABELS: Record<string, string> = {
  search_restaurants: "Searching restaurants",
  get_menu: "Browsing menu",
  place_order: "Placing order",
};

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  activeTool: string | null;
  onSendMessage: (content: string) => void;
}

export function ChatPanel({ messages, isLoading, activeTool, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      setInput("");
      onSendMessage(trimmed);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          AI Agent
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          <span className="text-xs text-gray-400">Ready</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">Order food with AI</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Ask me to find restaurants, browse menus, or place an order for you.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {/* Bubble */}
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>

              {/* Tool call pills */}
              {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[85%]">
                  {msg.toolCalls.map((tc, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-xs text-blue-600 font-medium"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>
                      {TOOL_LABELS[tc.tool] ?? tc.tool}
                      <span className="text-blue-400 font-normal">
                        ${tc.cost.toFixed(2)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {/* Active tool indicator */}
        {activeTool && (
          <div className="flex items-start">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-gray-100 rounded-bl-sm">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0"></span>
              <span className="text-sm text-gray-600">
                {TOOL_LABELS[activeTool] ?? activeTool}&hellip;
              </span>
            </div>
          </div>
        )}

        {/* Thinking indicator (loading, no active tool) */}
        {isLoading && !activeTool && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-start">
            <div className="flex items-center gap-1 px-3.5 py-2.5 rounded-2xl bg-gray-100 rounded-bl-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"></span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 px-4 py-3 relative z-50">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI agent..."
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            style={{ minHeight: "42px", maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <svg
              className="w-4 h-4 text-white disabled:text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </form>
        <p className="mt-1.5 text-xs text-gray-400 text-center">
          Press Enter to send &middot; Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
