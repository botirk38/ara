"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useState, useRef, useEffect } from "react";
import {
  Send,
  Phone,
  Mail,
  Link2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  Bot,
  User,
  AlertTriangle,
} from "lucide-react";
import { formatAmount } from "@/lib/format";

interface RecoveryChatProps {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type ToolInput = Record<string, any>;
type ToolOutput = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

function getInput(part: { input?: unknown }): ToolInput {
  return (part.input ?? {}) as ToolInput;
}

function getOutput(part: { output?: unknown }): ToolOutput {
  return (part.output ?? {}) as ToolOutput;
}

export function RecoveryChat({
  invoiceId,
  invoiceNumber,
  customerName,
}: RecoveryChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, addToolApprovalResponse, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    sendAutomaticallyWhen:
      lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  const startRecovery = () => {
    sendMessage({
      text: `Start recovery for invoice ${invoiceId}. The invoice number is ${invoiceNumber} for customer ${customerName}. Load the invoice context first, then enrich the debtor, run the autonomy gate, and proceed with the appropriate recovery action.`,
    });
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-700">
            Chat with ARRA
          </h3>
          {status === "streaming" && (
            <span className="flex items-center gap-1 text-xs text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking...
            </span>
          )}
        </div>
        {messages.length === 0 && (
          <button
            onClick={startRecovery}
            className="text-xs px-3 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors"
          >
            Start Recovery
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-3">
            <Bot className="h-8 w-8" />
            <p>
              Click &quot;Start Recovery&quot; or type a message to begin
            </p>
            <p className="text-xs text-gray-300">
              ARRA will guide you through the recovery process with approval
              checkpoints
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-[10px] font-bold">A</span>
              </div>
            )}
            <div
              className={`max-w-[80%] ${
                message.role === "user"
                  ? "bg-black text-white rounded-2xl rounded-br-md px-4 py-2.5"
                  : "space-y-2"
              }`}
            >
              {message.parts?.map((part, i) => {
                if (part.type === "text" && part.text) {
                  return (
                    <div
                      key={i}
                      className={`text-sm leading-relaxed ${
                        message.role === "assistant"
                          ? "bg-gray-50 rounded-2xl rounded-bl-md px-4 py-2.5 text-gray-700"
                          : ""
                      }`}
                    >
                      {part.text}
                    </div>
                  );
                }

                // Tool approval requests — executePhoneCall
                if (
                  part.type === "tool-executePhoneCall" &&
                  part.state === "approval-requested"
                ) {
                  const inp = getInput(part);
                  return (
                    <ApprovalCard
                      key={part.approval.id}
                      icon={<Phone className="h-4 w-4 text-blue-600" />}
                      title="Place Recovery Call"
                      detail={`Call ${inp.customerName || "debtor"} at ${inp.phone || "unknown"}`}
                      content={inp.script as string | undefined}
                      onApprove={() =>
                        addToolApprovalResponse({
                          id: part.approval.id,
                          approved: true,
                        })
                      }
                      onDeny={() =>
                        addToolApprovalResponse({
                          id: part.approval.id,
                          approved: false,
                        })
                      }
                    />
                  );
                }

                // Tool approval requests — sendRecoveryEmail
                if (
                  part.type === "tool-sendRecoveryEmail" &&
                  part.state === "approval-requested"
                ) {
                  const inp = getInput(part);
                  return (
                    <ApprovalCard
                      key={part.approval.id}
                      icon={<Mail className="h-4 w-4 text-indigo-600" />}
                      title="Send Recovery Email"
                      detail={`To: ${inp.customerName || "debtor"} (${inp.to || "unknown"})`}
                      content={`Subject: ${inp.subject || ""}\n\n${inp.body || ""}`}
                      onApprove={() =>
                        addToolApprovalResponse({
                          id: part.approval.id,
                          approved: true,
                        })
                      }
                      onDeny={() =>
                        addToolApprovalResponse({
                          id: part.approval.id,
                          approved: false,
                        })
                      }
                    />
                  );
                }

                // Tool approval requests — createPaymentLink
                if (
                  part.type === "tool-createPaymentLink" &&
                  part.state === "approval-requested"
                ) {
                  const inp = getInput(part);
                  return (
                    <ApprovalCard
                      key={part.approval.id}
                      icon={<Link2 className="h-4 w-4 text-green-600" />}
                      title="Create Payment Link"
                      detail={`For invoice ${inp.invoiceNumber || ""} — £${inp.amount != null ? formatAmount(Number(inp.amount)) : "?"}`}
                      onApprove={() =>
                        addToolApprovalResponse({
                          id: part.approval.id,
                          approved: true,
                        })
                      }
                      onDeny={() =>
                        addToolApprovalResponse({
                          id: part.approval.id,
                          approved: false,
                        })
                      }
                    />
                  );
                }

                // Tool results — executePhoneCall
                if (
                  part.type === "tool-executePhoneCall" &&
                  part.state === "output-available"
                ) {
                  const out = getOutput(part);
                  return (
                    <ToolResultBadge
                      key={i}
                      icon={<Phone className="h-3.5 w-3.5" />}
                      label={`Call: ${out.message || "completed"}`}
                      success={out.status === "called"}
                    />
                  );
                }

                // Tool results — sendRecoveryEmail
                if (
                  part.type === "tool-sendRecoveryEmail" &&
                  part.state === "output-available"
                ) {
                  const out = getOutput(part);
                  return (
                    <ToolResultBadge
                      key={i}
                      icon={<Mail className="h-3.5 w-3.5" />}
                      label={`Email: ${out.message || "sent"}`}
                      success={out.status === "sent"}
                    />
                  );
                }

                // Tool results — createPaymentLink
                if (
                  part.type === "tool-createPaymentLink" &&
                  part.state === "output-available"
                ) {
                  const out = getOutput(part);
                  return (
                    <ToolResultBadge
                      key={i}
                      icon={<Link2 className="h-3.5 w-3.5" />}
                      label={`Payment link: ${out.paymentLink || "generated"}`}
                      success
                    />
                  );
                }

                // Tool results — escalateToHuman
                if (
                  part.type === "tool-escalateToHuman" &&
                  part.state === "output-available"
                ) {
                  const out = getOutput(part);
                  return (
                    <ToolResultBadge
                      key={i}
                      icon={<ShieldAlert className="h-3.5 w-3.5" />}
                      label={`Escalated: ${out.decision || "pending"}`}
                      success={out.decision === "approved"}
                    />
                  );
                }

                // Denied approvals
                if (
                  (part.type === "tool-executePhoneCall" ||
                    part.type === "tool-sendRecoveryEmail" ||
                    part.type === "tool-createPaymentLink") &&
                  part.state === "output-denied"
                ) {
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
                    >
                      <XCircle className="h-4 w-4" />
                      Action denied by user
                    </div>
                  );
                }

                // Loading states for auto-executed tools
                if (
                  (part.type === "tool-loadInvoiceContext" ||
                    part.type === "tool-enrichDebtor" ||
                    part.type === "tool-runAutonomyGate" ||
                    part.type === "tool-updateInvoiceStatus") &&
                  part.state === "input-available"
                ) {
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-gray-400"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Running {formatToolName(part.type)}...
                    </div>
                  );
                }

                // Tool results — loadInvoiceContext
                if (
                  part.type === "tool-loadInvoiceContext" &&
                  part.state === "output-available"
                ) {
                  const out = getOutput(part);
                  const inv = out.invoice as ToolOutput | undefined;
                  return (
                    <ToolResultBadge
                      key={i}
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      label={`Loaded: ${inv?.invoiceNumber || "invoice"} — £${inv?.amount != null ? formatAmount(Number(inv.amount)) : "?"}`}
                      success
                    />
                  );
                }

                // Tool results — enrichDebtor
                if (
                  part.type === "tool-enrichDebtor" &&
                  part.state === "output-available"
                ) {
                  const out = getOutput(part);
                  return (
                    <ToolResultBadge
                      key={i}
                      icon={<AlertTriangle className="h-3.5 w-3.5" />}
                      label={`Specter: ${out.riskSignal || "unknown"} risk`}
                      success={out.riskSignal !== "high"}
                    />
                  );
                }

                // Tool results — runAutonomyGate
                if (
                  part.type === "tool-runAutonomyGate" &&
                  part.state === "output-available"
                ) {
                  const out = getOutput(part);
                  return (
                    <ToolResultBadge
                      key={i}
                      icon={<ShieldAlert className="h-3.5 w-3.5" />}
                      label={`Gate: ${out.allowed ? "Allowed" : "Blocked"}`}
                      success={!!out.allowed}
                    />
                  );
                }

                // Tool results — updateInvoiceStatus
                if (
                  part.type === "tool-updateInvoiceStatus" &&
                  part.state === "output-available"
                ) {
                  const out = getOutput(part);
                  return (
                    <ToolResultBadge
                      key={i}
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      label={`Status: ${String(out.status || "updated").replace(/_/g, " ")}`}
                      success
                    />
                  );
                }

                // Escalation loading
                if (
                  part.type === "tool-escalateToHuman" &&
                  part.state === "input-available"
                ) {
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Escalating to human review — notifying Slack...
                    </div>
                  );
                }

                return null;
              })}
            </div>
            {message.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-100 px-4 py-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask ARRA something or give instructions..."
          className="flex-1 text-sm px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300"
          disabled={status === "streaming"}
        />
        <button
          type="submit"
          disabled={!input.trim() || status === "streaming"}
          className="px-3 py-2 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function ApprovalCard({
  icon,
  title,
  detail,
  content,
  onApprove,
  onDeny,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  content?: string;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-gray-800">{title}</span>
      </div>
      <p className="text-sm text-gray-600">{detail}</p>
      {content && (
        <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-white rounded-lg p-3 border border-amber-100 max-h-40 overflow-y-auto font-mono">
          {content}
        </pre>
      )}
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approve
        </button>
        <button
          onClick={onDeny}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
        >
          <XCircle className="h-3.5 w-3.5" />
          Deny
        </button>
      </div>
    </div>
  );
}

function ToolResultBadge({
  icon,
  label,
  success,
}: {
  icon: React.ReactNode;
  label: string;
  success?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
        success
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-red-50 text-red-700 border border-red-200"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

function formatToolName(type: string): string {
  const names: Record<string, string> = {
    "tool-loadInvoiceContext": "loading invoice context",
    "tool-enrichDebtor": "Specter enrichment",
    "tool-runAutonomyGate": "autonomy gate",
    "tool-updateInvoiceStatus": "status update",
  };
  return names[type] || type.replace("tool-", "");
}
