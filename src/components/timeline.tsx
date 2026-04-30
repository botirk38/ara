"use client";

import type { TimelineEvent } from "@/lib/types";
import {
  Info,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  AlertTriangle,
  Briefcase,
  Search,
} from "lucide-react";

const actorIcons: Record<string, React.ReactNode> = {
  ARRA: <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold">A</div>,
  Briefcase: <Briefcase className="h-4 w-4 text-blue-600" />,
  Specter: <Search className="h-4 w-4 text-purple-600" />,
  Debtor: <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">D</div>,
  System: <Info className="h-4 w-4 text-gray-400" />,
};

const eventTypeIcons: Record<string, React.ReactNode> = {
  info: <Info className="h-3.5 w-3.5 text-gray-400" />,
  success: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  blocked: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  call: <Phone className="h-3.5 w-3.5 text-blue-500" />,
  email: <Mail className="h-3.5 w-3.5 text-indigo-500" />,
  risk: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
};

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatTime(iso: string) {
  const d = new Date(iso);
  return timeFormatter.format(d);
}

export function Timeline({
  events,
  streaming,
}: {
  events: TimelineEvent[];
  streaming: boolean;
}) {
  return (
    <div className="space-y-0">
      {events.map((event, i) => {
        const isLatest = i === events.length - 1 && streaming;
        const isCall = event.eventType === "call" && isLatest;

        return (
          <div
            key={event.id}
            className={`flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 ${
              i >= events.length - 3 && events.length > 3
                ? "animate-fade-in"
                : ""
            } ${isCall ? "bg-blue-50" : ""}`}
          >
            <span className="text-xs text-gray-400 font-mono mt-0.5 min-w-[60px]">
              {formatTime(event.createdAt)}
            </span>
            <div className="flex items-center justify-center w-6 h-6 flex-shrink-0">
              {actorIcons[event.actor] || actorIcons.System}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {eventTypeIcons[event.eventType] || eventTypeIcons.info}
                <span className="text-sm text-gray-700">{event.message}</span>
              </div>
            </div>
            {isCall && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse-dot" />
                <span className="text-xs text-blue-600 font-medium">
                  Calling
                </span>
              </div>
            )}
          </div>
        );
      })}
      {streaming && (
        <div className="flex items-center gap-2 px-4 py-2.5 text-gray-400">
          <div className="flex gap-1">
            <div
              className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span className="text-xs">Processing...</span>
        </div>
      )}
    </div>
  );
}
