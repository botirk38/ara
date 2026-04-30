import { db } from "@/db";
import { timelineEvents } from "@/db/schema";
import { v4 as uuid } from "uuid";

export async function logEvent(
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
