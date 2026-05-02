import { db } from "@/db";
import { timelineEvents } from "@/db/schema";
import { v4 as uuid } from "uuid";
import { NextRequest } from "next/server";

const FORM_CONTENT_TYPES = [
  "application/x-www-form-urlencoded",
  "multipart/form-data",
];

function hasFormContentType(req: NextRequest): boolean {
  const ct = req.headers.get("content-type") ?? "";
  return FORM_CONTENT_TYPES.some((t) => ct.startsWith(t));
}

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get("invoiceId") || "";

  if (invoiceId && !ID_PATTERN.test(invoiceId)) {
    return new Response("Invalid invoiceId", { status: 400 });
  }

  let speechResult: string | null = null;

  if (hasFormContentType(req)) {
    try {
      const formData = await req.formData();
      speechResult = formData.get("SpeechResult") as string | null;
    } catch {
      return new Response("Invalid form data", { status: 400 });
    }
  }

  if (speechResult && invoiceId) {
    try {
      await db.insert(timelineEvents).values({
        id: uuid(),
        invoiceId,
        actor: "Debtor",
        message: `"${speechResult}"`,
        eventType: "info",
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[twilio/gather] DB insert failed:", err instanceof Error ? err.message : err);
    }
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB">Thank you. We have noted your response and will send a confirmation email shortly.</Say>
</Response>`;

  return new Response(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
}
