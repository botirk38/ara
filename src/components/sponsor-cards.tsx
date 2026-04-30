"use client";

import type { RecoveryState } from "@/lib/types";
import {
  Briefcase,
  Search,
  ShieldCheck,
} from "lucide-react";

interface CardConfig {
  label: string;
  icon: React.ReactNode;
  field: keyof Pick<RecoveryState, "briefcase" | "specter" | "autonomy">;
}

const cards: CardConfig[] = [
  {
    label: "Briefcase Context",
    icon: <Briefcase className="h-5 w-5" />,
    field: "briefcase",
  },
  {
    label: "Specter Risk",
    icon: <Search className="h-5 w-5" />,
    field: "specter",
  },
  {
    label: "Autonomy Gate",
    icon: <ShieldCheck className="h-5 w-5" />,
    field: "autonomy",
  },
];

function getStatusText(field: string, state: RecoveryState): string {
  const val = state[field as keyof RecoveryState];
  if (field === "specter" && val === "loaded") {
    return `${state.specterRisk || "Unknown"} risk`;
  }
  if (field === "autonomy") {
    if (val === "allowed") return "Allowed";
    if (val === "blocked") return "Blocked";
  }
  if (val === "loaded") return "Loaded";
  if (val === "loading") return "Loading...";
  return "Ready";
}

function getCardStyle(field: string, state: RecoveryState): string {
  const val = state[field as keyof RecoveryState];
  if (val === "loading") return "border-blue-200 bg-blue-50";
  if (val === "loaded" || val === "allowed") return "border-green-200 bg-white animate-flash-green";
  if (val === "blocked") return "border-red-200 bg-white animate-flash-red";
  return "border-gray-200 bg-white";
}

function getIconColor(field: string, state: RecoveryState): string {
  const val = state[field as keyof RecoveryState];
  if (val === "loading") return "text-blue-500";
  if (val === "loaded" || val === "allowed") return "text-green-600";
  if (val === "blocked") return "text-red-600";
  return "text-gray-400";
}

function getCheckIcon(field: string, state: RecoveryState): string {
  const val = state[field as keyof RecoveryState];
  if (val === "loading") return "⏳";
  if (val === "loaded" || val === "allowed") return "✓";
  if (val === "blocked") return "✗";
  return "—";
}

export function SponsorCards({ state }: { state: RecoveryState }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {cards.map((card) => (
        <div
          key={card.field}
          className={`rounded-xl border p-4 transition-all duration-300 ${getCardStyle(
            card.field,
            state
          )}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`${getIconColor(card.field, state)}`}>
              {card.icon}
            </span>
            <span className="text-sm font-mono">
              {getCheckIcon(card.field, state)}
            </span>
          </div>
          <p className="text-xs font-medium text-gray-500">{card.label}</p>
          <p className="text-sm font-semibold mt-0.5">
            {getStatusText(card.field, state)}
          </p>
        </div>
      ))}
    </div>
  );
}
