import type { AutonomyGateResult } from "./types";

interface InvoiceData {
  amount: number;
  daysOverdue: number;
  status: string;
}

interface CustomerData {
  relationship: string;
}

export function runAutonomyGate(
  invoice: InvoiceData,
  customer: CustomerData,
  specterRisk: string
): AutonomyGateResult {
  const reasons: string[] = [];

  const amountThresholdPassed = invoice.amount < 10000;
  const disputeCheckPassed = invoice.status !== "disputed";
  const daysOverduePassed = invoice.daysOverdue < 90;
  const specterRiskPassed = specterRisk !== "high";
  const relationshipPassed = customer.relationship !== "risky";

  if (!amountThresholdPassed)
    reasons.push("Invoice exceeds £10k autonomous threshold");
  if (!disputeCheckPassed) reasons.push("Invoice is disputed");
  if (!daysOverduePassed)
    reasons.push("Invoice is more than 90 days overdue");
  if (!specterRiskPassed) reasons.push("Specter risk signal is high");
  if (!relationshipPassed)
    reasons.push("Customer relationship is marked risky");

  return {
    allowed:
      amountThresholdPassed &&
      disputeCheckPassed &&
      daysOverduePassed &&
      specterRiskPassed &&
      relationshipPassed,
    reasons,
    checks: {
      amountThresholdPassed,
      disputeCheckPassed,
      daysOverduePassed,
      specterRiskPassed,
      relationshipPassed,
    },
  };
}
