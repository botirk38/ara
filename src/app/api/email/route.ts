import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { to, subject, body } = await req.json();

  if (process.env.RESEND_API_KEY) {
    try {
      const resendModule = await import("resend");
      const resend = new resendModule.Resend(process.env.RESEND_API_KEY);

      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "arra@briefcase-collect.demo",
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

  return Response.json({
    success: true,
    mock: true,
    message: "Email logged (no RESEND_API_KEY configured)",
  });
}
