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

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get("invoiceId") || "";

  let speechResult: string | null = null;

  if (hasFormContentType(req)) {
    const formData = await req.formData();
    const raw = formData.get("SpeechResult");
    speechResult = typeof raw === "string" ? raw : null;
  }

  if (speechResult) {
    await db.insert(timelineEvents).values({
      id: uuid(),
      invoiceId,
      actor: "Debtor",
      message: `"${speechResult}"`,
      eventType: "info",
      createdAt: new Date().toISOString(),
    });
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-GB">Thank you. We have noted your response and will send a confirmation email shortly.</Say>
</Response>`;

  return new Response(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
}
