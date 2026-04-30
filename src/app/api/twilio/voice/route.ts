import { db } from "@/db";
import { recoveryActions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actionId = searchParams.get("actionId");
  const invoiceId = searchParams.get("invoiceId");

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME;
  let script = companyName
    ? `Hi, this is ARRA calling on behalf of ${companyName}. We are following up on an overdue invoice. Please contact us at your earliest convenience.`
    : "Hi, this is ARRA calling to follow up on an overdue invoice. Please contact us at your earliest convenience.";

  if (actionId) {
    const rows = await db
      .select()
      .from(recoveryActions)
      .where(eq(recoveryActions.id, actionId));
    const action = rows[0];
    if (action?.content) {
      script = action.content;
    }
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB">${escapeXml(script)}</Say>
  <Gather input="speech" timeout="5" action="/api/twilio/gather?actionId=${escapeXml(actionId || '')}&amp;invoiceId=${escapeXml(invoiceId || '')}" method="POST">
    <Say voice="alice" language="en-GB">Please let us know when you expect to make this payment.</Say>
  </Gather>
  <Say voice="alice" language="en-GB">Thank you for your time. We will follow up by email.</Say>
</Response>`;

  return new Response(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
