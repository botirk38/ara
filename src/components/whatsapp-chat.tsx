"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, MessageCircle, Phone } from "lucide-react";

interface WassistMessage {
  id: string;
  role: "assistant" | "user";
  type: string;
  status: string | null;
  createdAt: string;
  text: { body: string } | null;
  listSelection: {
    text: string;
    buttonText: string;
    sections: { rows: { title: string; description: string }[] }[];
  } | null;
  template: { name: string; body: string } | null;
}

interface WassistConversation {
  id: string;
  contact: { phoneNumber: string; name: string | null };
  activeAgent: { id: string; name: string };
  lastMessage: { body: string; createdAt: string; role: string } | null;
  active: boolean;
}

export function WhatsAppChat() {
  const [conversations, setConversations] = useState<WassistConversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<WassistConversation | null>(null);
  const [messages, setMessages] = useState<WassistMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectConversation = useCallback(
    async (conv: WassistConversation) => {
      setSelectedConversation(conv);
      setLoadingMessages(true);
      setError(null);
      try {
        const res = await fetch(`/api/wassist/messages/${conv.id}`);
        if (!res.ok) throw new Error("Failed to fetch messages");
        const data = await res.json();
        const msgs = (data.results || []) as WassistMessage[];
        setMessages(msgs.reverse());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  useEffect(() => {
    async function fetchConversations() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/wassist/conversations");
        if (!res.ok) throw new Error("Failed to fetch conversations");
        const data = await res.json();
        const convs = data.results || [];
        setConversations(convs);
        if (convs.length > 0) {
          selectConversation(convs[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchConversations();
  }, [selectConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col h-[600px] bg-white rounded-xl border border-gray-200 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
        <p className="text-sm text-gray-500 mt-2">
          Loading WhatsApp conversations...
        </p>
      </div>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <div className="flex flex-col h-[600px] bg-white rounded-xl border border-gray-200 items-center justify-center">
        <MessageCircle className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-red-500 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-green-50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
          <Phone className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-800">
            WhatsApp Recovery
          </h3>
          {selectedConversation && (
            <p className="text-xs text-gray-500">
              {selectedConversation.contact.name ||
                selectedConversation.contact.phoneNumber}{" "}
              &middot; +{selectedConversation.contact.phoneNumber}
            </p>
          )}
        </div>
        {conversations.length > 1 && (
          <select
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            value={selectedConversation?.id || ""}
            onChange={(e) => {
              const conv = conversations.find((c) => c.id === e.target.value);
              if (conv) selectConversation(conv);
            }}
          >
            {conversations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contact.name || c.contact.phoneNumber}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ backgroundImage: "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 80 80\"><rect fill=\"%23f0fdf4\" width=\"80\" height=\"80\"/><circle cx=\"40\" cy=\"40\" r=\"1\" fill=\"%2322c55e\" opacity=\"0.1\"/></svg>')" }}
      >
        {loadingMessages && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-green-600" />
          </div>
        )}

        {!loadingMessages && messages.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2">
            <MessageCircle className="h-8 w-8" />
            <p>No messages yet</p>
          </div>
        )}

        {!loadingMessages && error && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-red-400 text-sm gap-2">
            <MessageCircle className="h-8 w-8" />
            <p>{error}</p>
          </div>
        )}

        {!loadingMessages &&
          messages.map((msg, idx) => {
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showDate =
              !prevMsg ||
              formatDate(msg.createdAt) !== formatDate(prevMsg.createdAt);

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex justify-center my-2">
                    <span className="text-[10px] bg-white/80 text-gray-500 px-3 py-1 rounded-full shadow-sm">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-lg shadow-sm text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-green-100 text-gray-800 rounded-br-none"
                        : "bg-white text-gray-800 rounded-bl-none border border-gray-100"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <p className="text-[10px] font-semibold text-green-700 mb-0.5">
                        ARRA
                      </p>
                    )}
                    {msg.text?.body && <p>{msg.text.body}</p>}
                    {msg.listSelection && (
                      <div>
                        <p>{msg.listSelection.text}</p>
                        <div className="mt-2 space-y-1">
                          {msg.listSelection.sections.map((section, si) =>
                            section.rows.map((row, ri) => (
                              <div
                                key={`${si}-${ri}`}
                                className="bg-green-50 border border-green-200 rounded px-2 py-1 text-xs"
                              >
                                <span className="font-medium">
                                  {row.title}
                                </span>
                                {row.description && (
                                  <span className="text-gray-500 ml-1">
                                    — {row.description}
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {msg.template && (
                      <div className="italic text-gray-600">
                        [Template: {msg.template.name}]
                      </div>
                    )}
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.role === "user"
                          ? "text-green-700"
                          : "text-gray-400"
                      } text-right`}
                    >
                      {formatTime(msg.createdAt)}
                      {msg.status === "delivered" && " ✓✓"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-400 text-center">
          Live WhatsApp conversation via Wassist &middot; Read-only view
        </p>
      </div>
    </div>
  );
}
