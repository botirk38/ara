"use client";

import { useRouter } from "next/navigation";
import type { InvoiceWithCustomer, RiskLevel } from "@/lib/types";
import { getRiskLevel } from "@/lib/types";

function RiskBadge({ level }: { level: RiskLevel }) {
  const styles = {
    low: "bg-green-50 text-green-700 border-green-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    high: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[level]}`}
    >
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    overdue: "bg-red-50 text-red-700 border-red-200",
    recovering: "bg-blue-50 text-blue-700 border-blue-200",
    promise_to_pay: "bg-green-50 text-green-700 border-green-200",
    paid: "bg-green-100 text-green-800 border-green-300",
    disputed: "bg-gray-50 text-gray-700 border-gray-200",
    human_review: "bg-amber-50 text-amber-700 border-amber-200",
  };

  const labels: Record<string, string> = {
    overdue: "Overdue",
    recovering: "Recovering",
    promise_to_pay: "Promise to Pay",
    paid: "Paid",
    disputed: "Disputed",
    human_review: "Human Review",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[status] || styles.overdue
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

export function InvoiceTable({
  invoices,
}: {
  invoices: InvoiceWithCustomer[];
}) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Days Overdue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Risk
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.map((inv) => {
              const risk = getRiskLevel(inv.daysOverdue, inv.amount);
              return (
                <tr
                  key={inv.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {inv.customer?.name || "Unknown"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-600">
                      {inv.invoiceNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      £{inv.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {inv.daysOverdue} days
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <RiskBadge level={risk} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        inv.status === "human_review"
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : inv.status === "overdue"
                          ? "bg-black text-white hover:bg-gray-800"
                          : "bg-gray-100 text-gray-500"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/invoices/${inv.id}`);
                      }}
                    >
                      {inv.status === "human_review"
                        ? "Review"
                        : inv.status === "overdue"
                        ? "Recover"
                        : "View"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
