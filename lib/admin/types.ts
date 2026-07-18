import type { OrderRecord } from "@/lib/payments/orderStore";
import type { PaymentStatus } from "@/lib/payments/types";

export type AdminSession = {
  id: string;
  emailHash: string;
  expiresAt: string;
};

export type AdminMetrics = {
  checkoutStarted: number;
  totalSales: number;
  totalRevenue: number;
  revenueToday: number;
  pendingOrders: number;
  approvedOrders: number;
  cancelledOrders: number;
  expiredOrders: number;
  refunds: number;
  chargebacks: number;
  conversionRate: number;
  abandonedCheckouts: number;
  customers: number;
  downloads: number;
};

export type AdminOrder = OrderRecord & {
  webhookCount: number;
  downloadCount: number;
  accountCreated: boolean;
};

export type OrderFilters = {
  query?: string;
  status?: PaymentStatus;
  productSlug?: string;
  email?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  page: number;
  pageSize: number;
};

export type PaginatedOrders = {
  items: AdminOrder[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminCustomer = {
  email: string;
  name: string | null;
  products: string[];
  firstPurchaseAt: string;
  lastPurchaseAt: string;
  lastLoginAt: string | null;
  downloads: number;
  approvedOrders: number;
  totalOrders: number;
};

export type WebhookEvent = {
  id: string;
  eventId: string | null;
  eventType: string | null;
  orderId: string;
  gatewayPaymentId: string;
  receivedAt: string;
  processedAt: string | null;
  result: string;
  latencyMs: number | null;
  payload: Record<string, unknown>;
};

export type AuditEvent = {
  id: string;
  level: "info" | "warn" | "error";
  event: string;
  actorType: "system" | "admin" | "customer" | "gateway";
  entityType: string;
  entityId: string | null;
  orderId: string | null;
  gatewayPaymentId: string | null;
  status: string | null;
  requestId: string;
  source: string;
  latencyMs: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditInput = Omit<AuditEvent, "id" | "createdAt" | "metadata"> & {
  actorIdHash?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type SalesPoint = {
  date: string;
  sales: number;
  revenue: number;
  checkouts: number;
  abandoned: number;
  downloads: number;
  customers: number;
};

export type OrderDetail = {
  order: AdminOrder;
  customerLastLoginAt: string | null;
  timeline: AuditEvent[];
  webhooks: WebhookEvent[];
};
