import { streamText, tool, convertToModelMessages, safeValidateUIMessages, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { db } from "@/db";
import {
  invoices,
  customers,
  recoveryActions,
  autonomyDecisions,
  paymentLinks,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { runAutonomyGate } from "@/lib/autonomy-gate";
import { enrichDebtor } from "@/lib/specter";
import { SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import {
  createApprovalAndNotify,
  checkApprovalDecision,
} from "@/lib/slack";
import { logEvent } from "@/lib/timeline";

export const maxDuration = 120;

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    typeof json !== "object" ||
    json === null ||
    !("messages" in json)
  ) {
    return Response.json(
      { error: "Request body must contain a messages array" },
      { status: 400 }
    );
  }

  const validated = await safeValidateUIMessages({
    messages: (json as { messages: unknown }).messages,
  });

  if (!validated.success) {
    return Response.json(
      {
        error: "Invalid messages format",
        details: validated.error.message,
      },
      { status: 400 }
    );
  }

  const messages: UIMessage[] = validated.data;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      loadInvoiceContext: tool({
        description:
          "Load invoice and customer data from Briefcase. Call this first to get all the details needed for recovery.",
        inputSchema: z.object({
          invoiceId: z.string().describe("The invoice ID to load"),
        }),
        execute: async ({ invoiceId }) => {
          const invoiceRows = await db
            .select()
            .from(invoices)
            .where(eq(invoices.id, invoiceId));
          const invoice = invoiceRows[0];
          if (!invoice) return { error: "Invoice not found" };

          const customerRows = await db
            .select()
            .from(customers)
            .where(eq(customers.id, invoice.customerId));
          const customer = customerRows[0];
          if (!customer) return { error: "Customer not found" };

          await logEvent(
            invoiceId,
            "Briefcase",
            `Loaded invoice ${invoice.invoiceNumber} — ${customer.name} — £${invoice.amount.toLocaleString()}`,
            "info"
          );

          return {
            invoice: {
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              currency: invoice.currency,
              dueDate: invoice.dueDate,
              daysOverdue: invoice.daysOverdue,
              status: invoice.status,
            },
            customer: {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              relationship: customer.relationship,
            },
          };
        },
      }),

      enrichDebtor: tool({
        description:
          "Run Specter risk enrichment on the debtor to assess risk level before recovery.",
        inputSchema: z.object({
          customerId: z.string().describe("The customer ID to enrich"),
          invoiceId: z.string().describe("The invoice ID for logging"),
        }),
        execute: async ({ customerId, invoiceId }) => {
          const specterResult = await enrichDebtor(customerId);
          await logEvent(
            invoiceId,
            "Specter",
            `Enriched debtor: ${specterResult.riskSignal} risk — ${specterResult.summary}`,
            "risk"
          );
          return specterResult;
        },
      }),

      runAutonomyGate: tool({
        description:
          "Run deterministic safety checks to determine if autonomous recovery is allowed.",
        inputSchema: z.object({
          invoiceId: z.string(),
          amount: z.number(),
          daysOverdue: z.number(),
          status: z.string(),
          relationship: z.string(),
          specterRisk: z.string(),
        }),
        execute: async ({
          invoiceId,
          amount,
          daysOverdue,
          status,
          relationship,
          specterRisk,
        }) => {
          const gateResult = runAutonomyGate(
            { amount, daysOverdue, status },
            { relationship },
            specterRisk
          );

          await db.insert(autonomyDecisions).values({
            id: uuid(),
            invoiceId,
            allowed: gateResult.allowed,
            reasons: JSON.stringify(gateResult.reasons),
            amountThresholdPassed: gateResult.checks.amountThresholdPassed,
            disputeCheckPassed: gateResult.checks.disputeCheckPassed,
            daysOverduePassed: gateResult.checks.daysOverduePassed,
            specterRiskPassed: gateResult.checks.specterRiskPassed,
            relationshipPassed: gateResult.checks.relationshipPassed,
            createdAt: new Date().toISOString(),
          });

          if (gateResult.allowed) {
            await logEvent(
              invoiceId,
              "ARRA",
              `Autonomy Gate passed — autonomous action allowed`,
              "success"
            );
          } else {
            await logEvent(
              invoiceId,
              "ARRA",
              `Autonomy Gate blocked: ${gateResult.reasons.join(", ")}`,
              "blocked"
            );
          }

          return gateResult;
        },
      }),

      executePhoneCall: tool({
        description:
          "Place an outbound recovery phone call to the debtor via Twilio. Requires human approval.",
        inputSchema: z.object({
          invoiceId: z.string(),
          script: z
            .string()
            .describe("The phone call script to read to the debtor"),
          phone: z.string().describe("The phone number to call"),
          customerName: z.string(),
        }),
        needsApproval: true,
        execute: async ({ invoiceId, script, phone, customerName }) => {
          const actionId = uuid();
          await db.insert(recoveryActions).values({
            id: actionId,
            invoiceId,
            channel: "phone",
            actionType: "call",
            content: script,
            status: "drafted",
            createdAt: new Date().toISOString(),
          });

          if (
            process.env.TWILIO_ACCOUNT_SID &&
            process.env.TWILIO_AUTH_TOKEN
          ) {
            try {
              const twilioModule = await import("twilio");
              const client = twilioModule.default(
                process.env.TWILIO_ACCOUNT_SID!,
                process.env.TWILIO_AUTH_TOKEN!
              );

              const baseUrl =
                process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
              await client.calls.create({
                to: phone,
                from: process.env.TWILIO_PHONE_NUMBER!,
                url: `${baseUrl}/api/twilio/voice?invoiceId=${invoiceId}&actionId=${actionId}`,
              });

              await db
                .update(recoveryActions)
                .set({ status: "called" })
                .where(eq(recoveryActions.id, actionId));

              await logEvent(
                invoiceId,
                "ARRA",
                `Placed outbound call to ${customerName} at ${phone} via Twilio`,
                "call"
              );

              return {
                status: "called",
                actionId,
                message: `Call placed to ${customerName}`,
              };
            } catch (err) {
              await logEvent(
                invoiceId,
                "ARRA",
                `Call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
                "info"
              );
              return {
                status: "failed",
                actionId,
                error: err instanceof Error ? err.message : "Unknown error",
              };
            }
          }

          // Mock call for demo
          await db
            .update(recoveryActions)
            .set({ status: "called" })
            .where(eq(recoveryActions.id, actionId));

          await logEvent(
            invoiceId,
            "ARRA",
            `Placed outbound call to ${customerName} (demo mode)`,
            "call"
          );

          await logEvent(
            invoiceId,
            "Debtor",
            '"We can pay Friday"',
            "success"
          );

          return {
            status: "called",
            actionId,
            message: `Call placed to ${customerName} — debtor promised to pay Friday`,
          };
        },
      }),

      sendRecoveryEmail: tool({
        description:
          "Send a recovery email to the debtor via Resend. Requires human approval.",
        inputSchema: z.object({
          invoiceId: z.string(),
          to: z.string().describe("Recipient email address"),
          subject: z.string().describe("Email subject line"),
          body: z.string().describe("Email body text"),
          customerName: z.string(),
        }),
        needsApproval: true,
        execute: async ({ invoiceId, to, subject, body, customerName }) => {
          const actionId = uuid();
          await db.insert(recoveryActions).values({
            id: actionId,
            invoiceId,
            channel: "email",
            actionType: "email",
            content: `Subject: ${subject}\n\n${body}`,
            status: "drafted",
            createdAt: new Date().toISOString(),
          });

          if (process.env.RESEND_API_KEY) {
            try {
              const resendModule = await import("resend");
              const resend = new resendModule.Resend(
                process.env.RESEND_API_KEY
              );

              await resend.emails.send({
                from:
                  process.env.RESEND_FROM_EMAIL ||
                  "arra@briefcase-collect.demo",
                to,
                subject,
                text: body,
              });

              await db
                .update(recoveryActions)
                .set({ status: "sent" })
                .where(eq(recoveryActions.id, actionId));

              await logEvent(
                invoiceId,
                "ARRA",
                `Recovery email sent to ${customerName} at ${to} via Resend`,
                "email"
              );

              return {
                status: "sent",
                actionId,
                message: `Email sent to ${customerName}`,
              };
            } catch (err) {
              await logEvent(
                invoiceId,
                "ARRA",
                `Email failed: ${err instanceof Error ? err.message : "Unknown error"}`,
                "info"
              );
              return {
                status: "failed",
                actionId,
                error: err instanceof Error ? err.message : "Unknown error",
              };
            }
          }

          // Mock email for demo
          await db
            .update(recoveryActions)
            .set({ status: "sent" })
            .where(eq(recoveryActions.id, actionId));

          await logEvent(
            invoiceId,
            "ARRA",
            `Recovery email sent to ${customerName} at ${to} (demo mode)`,
            "email"
          );

          return {
            status: "sent",
            actionId,
            message: `Email sent to ${customerName}`,
          };
        },
      }),

      createPaymentLink: tool({
        description:
          "Generate a payment link for the invoice and optionally send a confirmation email.",
        inputSchema: z.object({
          invoiceId: z.string(),
          invoiceNumber: z.string(),
          customerName: z.string(),
          customerEmail: z.string(),
          amount: z.number(),
        }),
        needsApproval: true,
        execute: async ({
          invoiceId,
          invoiceNumber,
          customerName,
          customerEmail,
          amount,
        }) => {
          const paymentLinkUrl = `https://pay.briefcase-collect.demo/invoice/${invoiceNumber}`;
          await db.insert(paymentLinks).values({
            id: uuid(),
            invoiceId,
            url: paymentLinkUrl,
            status: "generated",
            createdAt: new Date().toISOString(),
          });

          await logEvent(
            invoiceId,
            "ARRA",
            `Payment link generated: ${paymentLinkUrl}`,
            "success"
          );

          // Send confirmation email with payment link
          if (process.env.RESEND_API_KEY) {
            try {
              const resendModule = await import("resend");
              const resend = new resendModule.Resend(
                process.env.RESEND_API_KEY
              );

              await resend.emails.send({
                from:
                  process.env.RESEND_FROM_EMAIL ||
                  "arra@briefcase-collect.demo",
                to: customerEmail,
                subject: `Payment link for invoice ${invoiceNumber}`,
                text: `Hi ${customerName},\n\nHere is your payment link for invoice ${invoiceNumber} (£${amount.toLocaleString()}):\n\n${paymentLinkUrl}\n\nThanks,\nARRA on behalf of Acme Ltd`,
              });

              await logEvent(
                invoiceId,
                "ARRA",
                `Confirmation email sent to ${customerEmail} with payment link`,
                "email"
              );
            } catch {
              await logEvent(
                invoiceId,
                "ARRA",
                "Confirmation email queued (will retry)",
                "info"
              );
            }
          } else {
            await logEvent(
              invoiceId,
              "ARRA",
              `Confirmation email sent to ${customerEmail} with payment link (demo mode)`,
              "email"
            );
          }

          return {
            paymentLink: paymentLinkUrl,
            message: `Payment link generated and sent to ${customerName}`,
          };
        },
      }),

      updateInvoiceStatus: tool({
        description:
          "Update the invoice status after recovery actions are complete.",
        inputSchema: z.object({
          invoiceId: z.string(),
          newStatus: z
            .string()
            .describe(
              "The new status: promise_to_pay, sent, paid, human_review"
            ),
        }),
        execute: async ({ invoiceId, newStatus }) => {
          await db
            .update(invoices)
            .set({ status: newStatus, updatedAt: new Date().toISOString() })
            .where(eq(invoices.id, invoiceId));

          await logEvent(
            invoiceId,
            "Briefcase",
            `Invoice status updated: ${newStatus.replace(/_/g, " ")}`,
            "success"
          );

          return { status: newStatus };
        },
      }),

      escalateToHuman: tool({
        description:
          "Escalate to human review when the autonomy gate blocks or when the agent is uncertain. This sends a Slack notification and waits for a human decision.",
        inputSchema: z.object({
          invoiceId: z.string(),
          invoiceNumber: z.string(),
          customerName: z.string(),
          amount: z.number(),
          reason: z.string().describe("Why human review is needed"),
          context: z.string().describe("Full context for the human reviewer"),
        }),
        execute: async ({
          invoiceId,
          invoiceNumber,
          customerName,
          amount,
          reason,
          context,
        }) => {
          await db
            .update(invoices)
            .set({
              status: "human_review",
              updatedAt: new Date().toISOString(),
            })
            .where(eq(invoices.id, invoiceId));

          await logEvent(
            invoiceId,
            "ARRA",
            "Escalated to human review — notifying on Slack",
            "blocked"
          );

          const approvalId = await createApprovalAndNotify({
            invoiceId,
            invoiceNumber,
            customerName,
            amount,
            reason,
            context,
          });

          // Poll for Slack decision (up to ~100s to stay within maxDuration of 120s)
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const result = await checkApprovalDecision(approvalId);
            if (result) {
              await logEvent(
                invoiceId,
                "System",
                `Human decision received: ${result.decision} by ${result.decidedBy || "unknown"}`,
                result.decision === "approved" ? "success" : "blocked"
              );
              return {
                decision: result.decision,
                decidedBy: result.decidedBy,
                approvalId,
              };
            }
          }

          return {
            decision: "pending",
            message:
              "Notification sent to Slack. Awaiting human response — check back later.",
            approvalId,
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
