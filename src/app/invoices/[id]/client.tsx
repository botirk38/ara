"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type {
  TimelineEvent,
  RecoveryState,
  AutonomyGateResult,
  InvoiceWithCustomer,
} from "@/lib/types";
import { getRiskLevel } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { Timeline } from "@/components/timeline";
import { SponsorCards } from "@/components/sponsor-cards";
import { RightPanel } from "@/components/right-panel";
import { RecoveryButton } from "@/components/recovery-button";
import { RecoveryChat } from "@/components/recovery-chat";
import { ArrowLeft, MessageSquare, List } from "lucide-react";

interface Props {
  invoice: InvoiceWithCustomer;
  initialEvents: TimelineEvent[];
  initialGateResult: AutonomyGateResult | null;
}

export function InvoiceDetailClient({
  invoice,
  initialEvents,
  initialGateResult,
}: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [streaming, setStreaming] = useState(false);
  const [gateResult, setGateResult] = useState<AutonomyGateResult | null>(
    initialGateResult
  );
  const [actionContent, setActionContent] = useState<string | null>(null);
  const [actionChannel, setActionChannel] = useState<string | null>(null);

  const hasRunRecovery =
    invoice.status !== "overdue" || initialGateResult !== null;

  const [state, setState] = useState<RecoveryState>({
    briefcase: hasRunRecovery ? "loaded" : "idle",
    specter: hasRunRecovery ? "loaded" : "idle",
    autonomy: initialGateResult
      ? initialGateResult.allowed
        ? "allowed"
        : "blocked"
      : "idle",
    phase:
      invoice.status === "human_review"
        ? "blocked"
        : invoice.status === "promise_to_pay" || invoice.status === "paid" || invoice.status === "sent"
        ? "complete"
        : invoice.status === "recovering"
        ? "running"
        : "idle",
  });

  const onTimelineEvent = useCallback((event: TimelineEvent) => {
    setEvents((prev) => [...prev, event]);
    setStreaming(true);
  }, []);

  const onStateChange = useCallback(
    (field: string, value: string, extra?: Record<string, unknown>) => {
      setState((prev) => {
        const next = { ...prev, [field]: value };
        if (field === "specter" && extra?.risk) {
          next.specterRisk = extra.risk as string;
        }
        return next;
      });
      if (
        value === "complete" ||
        value === "blocked"
      ) {
        setStreaming(false);
      }
    },
    []
  );

  const onGateResult = useCallback((result: AutonomyGateResult) => {
    setGateResult(result);
  }, []);

  const onAction = useCallback(
    (action: {
      id: string;
      channel: string;
      strategy: string;
      content: string;
    }) => {
      setActionContent(action.content);
      setActionChannel(action.channel);
    },
    []
  );

  const [mode, setMode] = useState<"auto" | "chat">("auto");

  const risk = getRiskLevel(invoice.daysOverdue, invoice.amount);
  const riskColors = {
    low: "text-green-700 bg-green-50",
    medium: "text-amber-700 bg-amber-50",
    high: "text-red-700 bg-red-50",
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </Link>
            <div className="w-px h-6 bg-gray-200" />
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <h1 className="text-lg font-semibold">
              ARRA{" "}
              <span className="text-gray-400 font-normal">
                / Briefcase Collect
              </span>
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">
                  {invoice.invoiceNumber}
                </h2>
                <span className="text-gray-400">—</span>
                <span className="text-lg text-gray-600">
                  {invoice.customer.name}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-3xl font-bold">
                  £{formatAmount(invoice.amount)}
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-red-600 font-medium">
                  {invoice.daysOverdue} days overdue
                </span>
                <span className="text-gray-400">|</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColors[risk]}`}
                >
                  {risk.charAt(0).toUpperCase() + risk.slice(1)} Risk
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Mode toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setMode("auto")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === "auto"
                      ? "bg-black text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Auto
                </button>
                <button
                  onClick={() => setMode("chat")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === "chat"
                      ? "bg-black text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat
                </button>
              </div>
              {mode === "auto" && (
                <RecoveryButton
                  invoiceId={invoice.id}
                  initialStatus={invoice.status}
                  onTimelineEvent={onTimelineEvent}
                  onStateChange={onStateChange}
                  onGateResult={onGateResult}
                  onAction={onAction}
                />
              )}
            </div>
          </div>
        </div>

        {mode === "auto" ? (
          <>
            {/* Sponsor Cards */}
            <SponsorCards state={state} />

            {/* Timeline + Right Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                      Recovery Timeline
                    </h3>
                  </div>
                  <Timeline events={events} streaming={streaming} />
                  {events.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-sm">
                      Click &quot;Start Recovery&quot; to begin the autonomous
                      recovery process
                    </div>
                  )}
                </div>
              </div>
              <div className="lg:col-span-2">
                <RightPanel
                  invoice={invoice}
                  gateResult={gateResult}
                  actionContent={actionContent}
                  actionChannel={actionChannel}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <RecoveryChat
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoiceNumber}
                customerName={invoice.customer.name}
              />
            </div>
            <div className="lg:col-span-2">
              <RightPanel
                invoice={invoice}
                gateResult={gateResult}
                actionContent={actionContent}
                actionChannel={actionChannel}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
