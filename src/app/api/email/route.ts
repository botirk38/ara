import { NextRequest } from "next/server";
import { z } from "zod";

const emailRequestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return Response.json(
      {
        success: false,
        error: "Email delivery service is not configured",
      },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = emailRequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: "Invalid request body",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { to, subject, body } = parsed.data;

  try {
    const resendModule = await import("resend");
    const resend = new resendModule.Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject,
      text: body,
    });

    return Response.json({ success: true, result });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Send failed",
      },
      { status: 500 }
    );
  }
}
