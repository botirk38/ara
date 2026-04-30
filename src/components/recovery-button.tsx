"use client";

import { useState, useCallback } from "react";
import type {
  TimelineEvent,
  AutonomyGateResult,
} from "@/lib/types";
import { Loader2, Play, CheckCircle2, XCircle } from "lucide-react";

type Phase = "idle" | "running" | "complete" | "blocked";

interface RecoveryButtonProps {
  invoiceId: string;
  initialStatus: string;
  onTimelineEvent: (event: TimelineEvent) => void;
  onStateChange: (field: string, value: string, extra?: Record<string, unknown>) => void;
  onGateResult: (result: AutonomyGateResult) => void;
  onAction: (action: { id: string; channel: string; strategy: string; content: string }) => void;
}

export function RecoveryButton({
  invoiceId,
  initialStatus,
  onTimelineEvent,
  onStateChange,
  onGateResult,
  onAction,
}: RecoveryButtonProps) {
  const [phase, setPhase] = useState<Phase>(
    initialStatus === "human_review"
      ? "blocked"
      : initialStatus === "promise_to_pay" || initialStatus === "paid" || initialStatus === "sent"
      ? "complete"
      : initialStatus === "recovering"
      ? "running"
      : "idle"
  );

  const startRecovery = useCallback(async () => {
    setPhase("running");
    onStateChange("briefcase", "loading");
    onStateChange("phase", "running");

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/recover`, {
        method: "POST",
      });

      if (!response.ok || !response.body) {
        setPhase("idle");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "timeline") {
              onTimelineEvent(data.event);
            } else if (data.type === "state") {
              onStateChange(data.field, data.value, data.extra);
              if (data.field === "phase") {
                setPhase(data.value);
              }
            } else if (data.type === "gate") {
              onGateResult(data.result);
            } else if (data.type === "action") {
              onAction(data.action);
            } else if (data.type === "done") {
              setPhase(data.status === "blocked" ? "blocked" : "complete");
            } else if (data.type === "error") {
              setPhase("idle");
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch {
      setPhase("idle");
    }
  }, [invoiceId, onTimelineEvent, onStateChange, onGateResult, onAction]);

  if (phase === "complete" || phase === "blocked") {
    return (
      <button
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg ${
          phase === "complete"
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800"
        }`}
        disabled
      >
        {phase === "complete" ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Recovery Complete
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4" />
            Human Review Required
          </>
        )}
      </button>
    );
  }

  if (phase === "running") {
    return (
      <button
        className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-black text-white opacity-80 cursor-not-allowed"
        disabled
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Running...
      </button>
    );
  }

  return (
    <button
      onClick={startRecovery}
      className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-black text-white hover:bg-gray-800 transition-colors"
    >
      <Play className="h-4 w-4" />
      Start Recovery
    </button>
  );
}
