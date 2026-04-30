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

  try {
    return crypto.timingSafeEqual(
      Buffer.from(mySignature),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
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
    const parsedTimestamp = parseInt(timestamp);
    if (isNaN(parsedTimestamp) || Math.abs(now - parsedTimestamp) > 300) {
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

  let payload: { type?: string; actions?: { action_id: string; value: string }[]; user?: { name?: string; username?: string }; response_url?: string };
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return Response.json({ error: "Invalid payload JSON" }, { status: 400 });
  }

  if (payload.type !== "block_actions") {
    return Response.json({ ok: true });
  }

  const actions = Array.isArray(payload.actions) ? payload.actions : [];

  for (const action of actions) {
    if (
      action.action_id !== "arra_approve" &&
      action.action_id !== "arra_deny"
    ) {
      continue;
    }

    let actionValue: { approvalId: string };
    try {
      actionValue = JSON.parse(action.value);
    } catch {
      continue;
    }
    const { approvalId } = actionValue;
    if (!approvalId) continue;
    const decision =
      action.action_id === "arra_approve" ? "approved" : "denied";
    const user = payload.user ?? {};
    const decidedBy = String(user.name || user.username || "unknown");

    await db
      .update(pendingApprovals)
      .set({
        decision,
        decidedBy,
        decidedAt: new Date().toISOString(),
      })
      .where(eq(pendingApprovals.id, approvalId));

    // Update the Slack message to show the decision
    const responseUrl = typeof payload.response_url === "string" ? payload.response_url : null;
    if (responseUrl) {
      await fetch(responseUrl, {
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
