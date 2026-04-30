import { db } from "@/db";
import { specterEnrichments } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { SpecterEnrichment } from "./types";

export async function enrichDebtor(
  customerId: string
): Promise<SpecterEnrichment> {
  const rows = await db
    .select()
    .from(specterEnrichments)
    .where(eq(specterEnrichments.customerId, customerId));

  const existing = rows[0];

  if (existing) {
    return {
      riskSignal: existing.riskSignal as "low" | "medium" | "high",
      summary: `${existing.companyName}: ${existing.riskSignal} risk`,
      evidence: [
        existing.revenueSignal,
        existing.newsSignal,
      ].filter(Boolean) as string[],
      revenueSignal: existing.revenueSignal ?? undefined,
      newsSignal: existing.newsSignal ?? undefined,
    };
  }

  return {
    riskSignal: "medium",
    summary: "No Specter data available — defaulting to medium risk",
    evidence: ["No enrichment data found"],
  };
}
