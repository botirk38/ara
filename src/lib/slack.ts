import { db } from "@/db";
import { pendingApprovals } from "@/db/schema";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";

interface SlackNotification {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  reason: string;
  context: string;
}

interface SlackApprovalNotification extends SlackNotification {
  approvalId: string;
}

/**
 * Send a one-way Slack notification when ARRA needs human attention.
 * Uses Incoming Webhooks — simplest integration.
 */
export async function notifySlack(params: SlackNotification): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(
      "[Slack] No SLACK_WEBHOOK_URL configured — skipping notification"
    );
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "ARRA — Human Review Required",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Invoice:*\n${params.invoiceNumber}`,
            },
            {
              type: "mrkdwn",
              text: `*Customer:*\n${params.customerName}`,
            },
            {
              type: "mrkdwn",
              text: `*Amount:*\n£${params.amount.toLocaleString()}`,
            },
            {
              type: "mrkdwn",
              text: `*Reason:*\n${params.reason}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Context:*\n${params.context}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Review in ARRA" },
              url: `${baseUrl}/invoices/${params.invoiceId}`,
              style: "primary",
            },
          ],
        },
      ],
    }),
  });
}

/**
 * Send an interactive Slack notification with Approve / Deny / Chat buttons.
 * Uses Slack Web API (requires SLACK_BOT_TOKEN).
 */
export async function notifySlackWithApproval(
  params: SlackApprovalNotification
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;

  if (!token || !channel) {
    console.log(
      "[Slack] No SLACK_BOT_TOKEN or SLACK_CHANNEL_ID configured — falling back to webhook"
    );
    await notifySlack(params);
    return;
  }

  const { WebClient } = await import("@slack/web-api");
  const slack = new WebClient(token);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  await slack.chat.postMessage({
    channel,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "ARRA — Approval Required",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Invoice:*\n${params.invoiceNumber}`,
          },
          {
            type: "mrkdwn",
            text: `*Customer:*\n${params.customerName}`,
          },
          {
            type: "mrkdwn",
            text: `*Amount:*\n£${params.amount.toLocaleString()}`,
          },
          {
            type: "mrkdwn",
            text: `*Reason:*\n${params.reason}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Context:*\n${params.context}`,
        },
      },
      {
        type: "actions",
        block_id: `approval_${params.approvalId}`,
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            action_id: "arra_approve",
            value: JSON.stringify({
              approvalId: params.approvalId,
              invoiceId: params.invoiceId,
            }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Deny" },
            style: "danger",
            action_id: "arra_deny",
            value: JSON.stringify({
              approvalId: params.approvalId,
              invoiceId: params.invoiceId,
            }),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Open in ARRA" },
            action_id: "arra_open",
            url: `${baseUrl}/invoices/${params.invoiceId}`,
          },
        ],
      },
    ],
  });
}

/**
 * Create a pending approval record and send Slack notification.
 * Returns the approval ID for polling.
 */
export async function createApprovalAndNotify(params: {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  reason: string;
  context: string;
}): Promise<string> {
  const approvalId = uuid();

  await db.insert(pendingApprovals).values({
    id: approvalId,
    invoiceId: params.invoiceId,
    reason: params.reason,
    context: params.context,
    createdAt: new Date().toISOString(),
  });

  await notifySlackWithApproval({ ...params, approvalId });

  return approvalId;
}

/**
 * Poll for a pending approval decision.
 * Returns the decision when available or null if still pending.
 */
export async function checkApprovalDecision(
  approvalId: string
): Promise<{ decision: string; decidedBy: string | null } | null> {
  const rows = await db
    .select()
    .from(pendingApprovals)
    .where(eq(pendingApprovals.id, approvalId));

  const row = rows[0];
  if (!row || !row.decision) return null;

  return { decision: row.decision, decidedBy: row.decidedBy };
}
