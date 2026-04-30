import { db } from "@/db";
import {
  invoices,
  customers,
  recoveryActions,
  autonomyDecisions,
  timelineEvents,
  paymentLinks,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { runAutonomyGate } from "@/lib/autonomy-gate";
import { enrichDebtor } from "@/lib/specter";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "@/lib/agent/system-prompt";

async function logEvent(
  invoiceId: string,
  actor: string,
  message: string,
  eventType: string
) {
  const event = {
    id: uuid(),
    invoiceId,
    actor,
    message,
    eventType,
    createdAt: new Date().toISOString(),
  };
  await db.insert(timelineEvents).values(event);
  return event;
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id));
  const invoice = invoiceRows[0];
  if (!invoice) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  const customerRows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, invoice.customerId));
  const customer = customerRows[0];
  if (!customer) {
    return Response.json({ error: "Customer not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      function send(data: Record<string, unknown>) {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }
      function closeStream() {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }

      try {
        // 1. Update status to recovering
        await db
          .update(invoices)
          .set({ status: "recovering", updatedAt: new Date().toISOString() })
          .where(eq(invoices.id, id));

        // 2. Log briefcase context loaded
        const evt1 = await logEvent(
          id,
          "Briefcase",
          `Loaded invoice ${invoice.invoiceNumber} — ${customer.name} — £${invoice.amount.toLocaleString()}`,
          "info"
        );
        send({ type: "timeline", event: evt1 });
        send({
          type: "state",
          field: "briefcase",
          value: "loaded",
        });

        // 3. Specter enrichment
        send({ type: "state", field: "specter", value: "loading" });
        const specterResult = await enrichDebtor(customer.id);
        const evt2 = await logEvent(
          id,
          "Specter",
          `Enriched debtor: ${specterResult.riskSignal} risk — ${specterResult.summary}`,
          "risk"
        );
        send({ type: "timeline", event: evt2 });
        send({
          type: "state",
          field: "specter",
          value: "loaded",
          extra: { risk: specterResult.riskSignal },
        });

        // 4. Autonomy Gate
        send({ type: "state", field: "autonomy", value: "loading" });
        const gateResult = runAutonomyGate(
          invoice,
          customer,
          specterResult.riskSignal
        );

        await db.insert(autonomyDecisions).values({
          id: uuid(),
          invoiceId: id,
          allowed: gateResult.allowed,
          reasons: JSON.stringify(gateResult.reasons),
          amountThresholdPassed: gateResult.checks.amountThresholdPassed,
          disputeCheckPassed: gateResult.checks.disputeCheckPassed,
          daysOverduePassed: gateResult.checks.daysOverduePassed,
          specterRiskPassed: gateResult.checks.specterRiskPassed,
          relationshipPassed: gateResult.checks.relationshipPassed,
          createdAt: new Date().toISOString(),
        });

        if (!gateResult.allowed) {
          const evt3 = await logEvent(
            id,
            "ARRA",
            `Autonomy Gate blocked: ${gateResult.reasons.join(", ")}`,
            "blocked"
          );
          send({ type: "timeline", event: evt3 });
          send({ type: "state", field: "autonomy", value: "blocked" });
          send({
            type: "gate",
            result: gateResult,
          });

          await db
            .update(invoices)
            .set({
              status: "human_review",
              updatedAt: new Date().toISOString(),
            })
            .where(eq(invoices.id, id));

          const evt4 = await logEvent(
            id,
            "ARRA",
            "Escalated to human review — autonomous action not permitted",
            "blocked"
          );
          send({ type: "timeline", event: evt4 });
          send({ type: "state", field: "phase", value: "blocked" });
          send({ type: "done", status: "blocked" });
          closeStream();
          return;
        }

        const evt3 = await logEvent(
          id,
          "ARRA",
          `Autonomy Gate passed: ${Object.entries(gateResult.checks)
            .filter(([, v]) => v)
            .map(([k]) => k.replace(/([A-Z])/g, " $1").toLowerCase())
            .join(", ")}`,
          "success"
        );
        send({ type: "timeline", event: evt3 });
        send({ type: "state", field: "autonomy", value: "allowed" });
        send({ type: "gate", result: gateResult });

        // 5. Determine channel based on days overdue
        const channel =
          invoice.daysOverdue >= 30
            ? "phone"
            : invoice.daysOverdue >= 10
            ? "email"
            : "email";
        const strategy =
          invoice.daysOverdue <= 7
            ? "friendly_reminder"
            : invoice.daysOverdue <= 30
            ? "firm_followup"
            : "escalated_recovery";

        // 6. Draft recovery action using LLM
        if (!process.env.OPENAI_API_KEY) {
          throw new Error(
            "OPENAI_API_KEY is required for LLM-powered recovery drafting."
          );
        }

        const { text: actionContent } = await generateText({
          model: openai("gpt-4o-mini"),
          system: SYSTEM_PROMPT,
          prompt: `Draft a ${channel} recovery action for this invoice.

Invoice: ${invoice.invoiceNumber}
Amount: £${invoice.amount.toLocaleString()}
Due Date: ${invoice.dueDate}
Days Overdue: ${invoice.daysOverdue}
Customer: ${customer.name}
Contact Email: ${customer.email}
Contact Phone: ${customer.phone}
Strategy: ${strategy}
Channel: ${channel}

${
  channel === "phone"
    ? "Write a professional phone call script. Be concise, mention the invoice number and amount, and ask about payment scheduling."
    : "Write a professional email. Include a subject line on the first line, then the body. Mention the invoice number, amount, and due date."
}`,
        });

        const actionId = uuid();
        await db.insert(recoveryActions).values({
          id: actionId,
          invoiceId: id,
          channel,
          actionType: channel === "phone" ? "call" : "email",
          content: actionContent,
          status: "drafted",
          createdAt: new Date().toISOString(),
        });

        const evt5 = await logEvent(
          id,
          "ARRA",
          `Selected channel: ${channel} — Strategy: ${strategy}`,
          "info"
        );
        send({ type: "timeline", event: evt5 });
        send({
          type: "action",
          action: { id: actionId, channel, strategy, content: actionContent },
        });

        // 7. Execute action via Twilio/Resend
        if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
          throw new Error(
            "RESEND_API_KEY and RESEND_FROM_EMAIL are required for email delivery."
          );
        }

        let channelDelivered = true;
        if (channel === "phone") {
          if (
            !process.env.TWILIO_ACCOUNT_SID ||
            !process.env.TWILIO_AUTH_TOKEN ||
            !process.env.TWILIO_PHONE_NUMBER ||
            !process.env.NEXT_PUBLIC_BASE_URL
          ) {
            throw new Error(
              "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and NEXT_PUBLIC_BASE_URL are required for outbound calls."
            );
          }

          const evt6 = await logEvent(
            id,
            "ARRA",
            "Placing outbound call via Twilio...",
            "call"
          );
          send({ type: "timeline", event: evt6 });

          try {
            const twilioModule = await import("twilio");
            const client = twilioModule.default(
              process.env.TWILIO_ACCOUNT_SID,
              process.env.TWILIO_AUTH_TOKEN
            );

            await client.calls.create({
              to: customer.phone,
              from: process.env.TWILIO_PHONE_NUMBER,
              url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/twilio/voice?invoiceId=${id}&actionId=${actionId}`,
            });

            await db
              .update(recoveryActions)
              .set({ status: "called" })
              .where(eq(recoveryActions.id, actionId));

            const evt7 = await logEvent(
              id,
              "ARRA",
              "Twilio outbound call placed successfully",
              "call"
            );
            send({ type: "timeline", event: evt7 });
          } catch (err) {
            channelDelivered = false;
            const evt7 = await logEvent(
              id,
              "ARRA",
              `Call failed: ${err instanceof Error ? err.message : "Unknown error"} — requires manual follow-up`,
              "info"
            );
            send({ type: "timeline", event: evt7 });
          }
        } else {
          let emailSent = false;
          try {
            const resendModule = await import("resend");
            const resend = new resendModule.Resend(process.env.RESEND_API_KEY);

            const lines = actionContent.split("\n");
            const subject = lines[0].replace("Subject: ", "");
            const body = lines.slice(1).join("\n").trim();

            await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL,
              to: customer.email,
              subject,
              text: body,
            });

            emailSent = true;
            await db
              .update(recoveryActions)
              .set({ status: "sent" })
              .where(eq(recoveryActions.id, actionId));

            const evt6 = await logEvent(
              id,
              "ARRA",
              `Email sent to ${customer.email} via Resend`,
              "email"
            );
            send({ type: "timeline", event: evt6 });
          } catch (err) {
            const evt6 = await logEvent(
              id,
              "ARRA",
              `Email send failed: ${err instanceof Error ? err.message : "Unknown error"} — logged for retry`,
              "info"
            );
            send({ type: "timeline", event: evt6 });
          }
          channelDelivered = emailSent;
        }

        // 8. Create payment link
        if (!process.env.NEXT_PUBLIC_BASE_URL) {
          throw new Error(
            "NEXT_PUBLIC_BASE_URL is required for generating payment links."
          );
        }
        const paymentLinkUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/pay/${invoice.invoiceNumber}`;
        await db.insert(paymentLinks).values({
          id: uuid(),
          invoiceId: id,
          url: paymentLinkUrl,
          status: "generated",
          createdAt: new Date().toISOString(),
        });

        const evt9 = await logEvent(
          id,
          "ARRA",
          `Payment link generated: ${paymentLinkUrl}`,
          "success"
        );
        send({ type: "timeline", event: evt9 });

        // 9. Send confirmation email with payment link
        if (channel === "phone" && channelDelivered) {
          try {
            const resendModule2 = await import("resend");
            const resend = new resendModule2.Resend(process.env.RESEND_API_KEY);

            await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL,
              to: customer.email,
              subject: `Confirmation for invoice ${invoice.invoiceNumber}`,
              text: `Hi ${customer.name},\n\nThanks for speaking with us today. As discussed, invoice ${invoice.invoiceNumber} for £${invoice.amount.toLocaleString()} is expected to be paid.\n\nYou can use this payment link:\n${paymentLinkUrl}\n\nThanks,\nARRA on behalf of Acme Ltd`,
            });

            const evt10 = await logEvent(
              id,
              "ARRA",
              `Confirmation email sent to ${customer.email} with payment link`,
              "email"
            );
            send({ type: "timeline", event: evt10 });
          } catch (err) {
            const evt10 = await logEvent(
              id,
              "ARRA",
              `Confirmation email failed: ${err instanceof Error ? err.message : "Unknown error"}`,
              "info"
            );
            send({ type: "timeline", event: evt10 });
          }
        }

        // 10. Update invoice status
        const newStatus = !channelDelivered
          ? "recovering"
          : channel === "phone"
          ? "promise_to_pay"
          : "sent";
        await db
          .update(invoices)
          .set({ status: newStatus, updatedAt: new Date().toISOString() })
          .where(eq(invoices.id, id));

        const evt11 = await logEvent(
          id,
          "Briefcase",
          `Invoice status updated: ${newStatus.replace(/_/g, " ")}`,
          "success"
        );
        send({ type: "timeline", event: evt11 });
        send({ type: "state", field: "phase", value: "complete" });
        send({ type: "done", status: "complete" });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        await logEvent(id, "System", `Recovery error: ${message}`, "blocked");
        await db
          .update(invoices)
          .set({ status: "overdue", updatedAt: new Date().toISOString() })
          .where(eq(invoices.id, id));
        send({ type: "error", message });
      } finally {
        closeStream();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
