import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return Response.json(
      {
        success: false,
        error:
          "RESEND_API_KEY and RESEND_FROM_EMAIL are required for email delivery.",
      },
      { status: 500 }
    );
  }

  const { to, subject, body } = await req.json();

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
