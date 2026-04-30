export interface InvoiceWithCustomer {
  id: string;
  customerId: string;
  invoiceNumber: string;
  amount: number;
  currency: string | null;
  dueDate: string;
  daysOverdue: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    whatsapp: string | null;
    relationship: string;
    avgDaysLate: number | null;
    createdAt: string;
  };
}

export interface TimelineEvent {
  id: string;
  invoiceId: string;
  actor: string;
  message: string;
  eventType: string;
  createdAt: string;
}

export interface AutonomyGateResult {
  allowed: boolean;
  reasons: string[];
  checks: {
    amountThresholdPassed: boolean;
    disputeCheckPassed: boolean;
    daysOverduePassed: boolean;
    specterRiskPassed: boolean;
    relationshipPassed: boolean;
  };
}

export interface SpecterEnrichment {
  riskSignal: "low" | "medium" | "high";
  summary: string;
  evidence: string[];
  revenueSignal?: string;
  newsSignal?: string;
}

export interface RecoveryState {
  briefcase: "idle" | "loading" | "loaded";
  specter: "idle" | "loading" | "loaded";
  specterRisk?: string;
  autonomy: "idle" | "loading" | "allowed" | "blocked";

  phase: "idle" | "running" | "complete" | "blocked";
}

export interface DashboardStats {
  totalOverdue: number;
  invoiceCount: number;
  recoveredToday: number;
  blockedCount: number;
}

export type RiskLevel = "low" | "medium" | "high";

export function getRiskLevel(daysOverdue: number, amount: number): RiskLevel {
  if (daysOverdue >= 90 || amount >= 10000) return "high";
  if (daysOverdue >= 30 || amount >= 5000) return "medium";
  return "low";
}
