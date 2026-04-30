import { db } from "@/db";
import { pendingApprovals } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", signingSecret)
      .update(sigBasestring)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  // Verify Slack signature if signing secret is configured
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (signingSecret) {
    const timestamp = req.headers.get("x-slack-request-timestamp") || "";
    const signature = req.headers.get("x-slack-signature") || "";

    // Reject requests older than 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return Response.json({ error: "Request too old" }, { status: 403 });
    }

    if (!verifySlackSignature(signingSecret, timestamp, rawBody, signature)) {
      return Response.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  // Parse the Slack interaction payload
  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get("payload");
  if (!payloadStr) {
    return Response.json({ error: "Missing payload" }, { status: 400 });
  }

  const payload = JSON.parse(payloadStr);

  if (payload.type !== "block_actions") {
    return Response.json({ ok: true });
  }

  for (const action of payload.actions || []) {
    if (
      action.action_id !== "arra_approve" &&
      action.action_id !== "arra_deny"
    ) {
      continue;
    }

    const { approvalId } = JSON.parse(action.value);
    const decision =
      action.action_id === "arra_approve" ? "approved" : "denied";
    const decidedBy = payload.user?.name || payload.user?.username || "unknown";

    await db
      .update(pendingApprovals)
      .set({
        decision,
        decidedBy,
        decidedAt: new Date().toISOString(),
      })
      .where(eq(pendingApprovals.id, approvalId));

    // Update the Slack message to show the decision
    if (payload.response_url) {
      await fetch(payload.response_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace_original: true,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*ARRA Approval ${decision === "approved" ? "Approved" : "Denied"}* by ${decidedBy}`,
              },
            },
          ],
        }),
      });
    }
  }

  return Response.json({ ok: true });
}
