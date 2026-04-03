"use client";

import { ChatPanel } from "@/components/ChatPanel";
import { PlatformView } from "@/components/PlatformView";
import { useAgent } from "@/hooks/useAgent";
import { usePaymentEvents } from "@/hooks/usePaymentEvents";

export default function Home() {
  const { messages, isLoading, activeTool, sendMessage, resetChat } = useAgent();
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
          <h1 className="text-lg font-semibold text-gray-800">Agentic Commerce on Tempo</h1>
          <p className="text-xs text-gray-500">Machine Payments Protocol &middot; DoorDash Demo</p>
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
        <div className="w-1/2 border-r border-gray-200">
          <ChatPanel messages={messages} isLoading={isLoading} activeTool={activeTool} onSendMessage={sendMessage} />
        </div>
        <div className="w-1/2">
          <PlatformView state={sessionState} />
        </div>
      </div>
    </div>
  );
}
