"use client";

import type { AutonomyGateResult } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import { CheckCircle2, XCircle } from "lucide-react";

interface RightPanelProps {
  invoice: {
    invoiceNumber: string;
    amount: number;
    dueDate: string;
    daysOverdue: number;
    status: string;
    customer: {
      name: string;
      email: string;
      phone: string;
      relationship: string;
    };
  };
  gateResult: AutonomyGateResult | null;
  actionContent: string | null;
  actionChannel: string | null;
}

export function RightPanel({
  invoice,
  gateResult,
  actionContent,
  actionChannel,
}: RightPanelProps) {
  return (
    <div className="space-y-4">
      {/* Invoice Context */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Invoice Context
        </h3>
        <dl className="space-y-2 text-sm">
          <Row label="Customer" value={invoice.customer.name} />
          <Row
            label="Amount"
            value={`£${formatAmount(invoice.amount)}`}
          />
          <Row label="Due" value={invoice.dueDate} />
          <Row label="Overdue" value={`${invoice.daysOverdue} days`} />
          <Row label="Relationship" value={invoice.customer.relationship} />
          <Row
            label="Suggested Channel"
            value={
              invoice.daysOverdue >= 30
                ? "Phone"
                : "Email"
            }
          />
        </dl>
      </div>

      {/* Autonomy Gate */}
      {gateResult && (
        <div
          className={`bg-white rounded-xl border p-4 ${
            gateResult.allowed ? "border-green-200" : "border-red-200"
          }`}
        >
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Autonomy Gate
          </h3>
          <div className="space-y-2">
            {Object.entries(gateResult.checks).map(([key, passed]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                {passed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                )}
                <span className={passed ? "text-gray-700" : "text-red-700"}>
                  {formatCheckName(key)}
                </span>
              </div>
            ))}
          </div>
          <div
            className={`mt-3 pt-3 border-t text-sm font-medium ${
              gateResult.allowed
                ? "text-green-700 border-green-100"
                : "text-red-700 border-red-100"
            }`}
          >
            Decision:{" "}
            {gateResult.allowed
              ? "Autonomous action allowed"
              : "Human review required"}
          </div>
          {gateResult.reasons.length > 0 && (
            <div className="mt-2 text-xs text-red-600">
              {gateResult.reasons.join(". ")}
            </div>
          )}
        </div>
      )}

      {/* Action Content */}
      {actionContent && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {actionChannel === "phone" ? "Call Script" : "Email Draft"}
          </h3>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3 leading-relaxed">
            {actionContent}
          </pre>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function formatCheckName(key: string): string {
  const names: Record<string, string> = {
    amountThresholdPassed: "Amount below £10k",
    disputeCheckPassed: "No dispute signal",
    daysOverduePassed: "Under 90 days overdue",
    specterRiskPassed: "Specter risk acceptable",
    relationshipPassed: "Customer relationship stable",
  };
  return names[key] || key;
}
