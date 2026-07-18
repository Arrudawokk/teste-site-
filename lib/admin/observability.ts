import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { logger } from "@/lib/server/logger";
import { getAdminStore } from "./store";
import type { AuditInput } from "./types";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function getRequestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : randomUUID();
}

export function scheduleAudit(input: AuditInput): void {
  after(async () => {
    try {
      await getAdminStore().recordAudit(input);
    } catch {
      logger.warn("observability.audit_unavailable", { eventName: input.event, requestId: input.requestId });
    }
  });
}

export function scheduleDownloadAudit(input: { orderId: string; accountId?: string; requestId: string; source: string; result: string }): void {
  after(async () => {
    try {
      await getAdminStore().recordDownload(input);
    } catch {
      logger.warn("observability.download_unavailable", { orderId: input.orderId, requestId: input.requestId });
    }
  });
}

export function scheduleWebhookEnrichment(input: { eventKey: string; eventId: string; eventType: string; result: string; latencyMs: number; payload: Record<string, string | number | boolean | null> }): void {
  after(async () => {
    try {
      await getAdminStore().enrichWebhook(input);
    } catch {
      logger.warn("observability.webhook_unavailable", { requestId: input.eventId, eventName: input.eventType });
    }
  });
}
