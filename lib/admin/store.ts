import "server-only";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { OrderRecord, ProductAccessStatus } from "@/lib/payments/orderStore";
import type { PaymentMethodType, PaymentStatus } from "@/lib/payments/types";
import type {
  AdminCustomer,
  AdminMetrics,
  AdminOrder,
  AdminSession,
  AuditEvent,
  AuditInput,
  OrderDetail,
  OrderFilters,
  PaginatedOrders,
  SalesPoint,
  WebhookEvent,
} from "./types";

export class AdminStoreUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AdminStoreUnavailableError";
  }
}

export interface AdminStore {
  createSession(tokenHash: string, emailHash: string, expiresAt: string): Promise<AdminSession>;
  getSession(tokenHash: string): Promise<AdminSession | null>;
  revokeSession(tokenHash: string): Promise<void>;
  countRecentFailedLogins(fingerprintHash: string, windowMinutes: number): Promise<number>;
  recordLoginAttempt(fingerprintHash: string, succeeded: boolean): Promise<void>;
  getMetrics(): Promise<AdminMetrics>;
  listOrders(filters: OrderFilters): Promise<PaginatedOrders>;
  getOrderDetail(orderId: string): Promise<OrderDetail | null>;
  listCustomers(query: string, page: number, pageSize: number): Promise<{ items: AdminCustomer[]; total: number; totalPages: number }>;
  listWebhooks(query: string, page: number, pageSize: number): Promise<{ items: WebhookEvent[]; total: number; totalPages: number }>;
  listAuditEvents(query: string, level: string, page: number, pageSize: number): Promise<{ items: AuditEvent[]; total: number; totalPages: number }>;
  getSalesSeries(days: number): Promise<SalesPoint[]>;
  recordAudit(input: AuditInput): Promise<void>;
  recordDownload(input: { orderId: string; accountId?: string; requestId: string; source: string; result: string }): Promise<void>;
  enrichWebhook(input: { eventKey: string; eventId: string; eventType: string; result: string; latencyMs: number; payload: Record<string, string | number | boolean | null> }): Promise<void>;
}

type OrderRow = {
  external_reference: string;
  product_slug: string;
  amount_cents: number;
  currency: string;
  payer_email: string;
  payer_name: string | null;
  payment_gateway: "mercado_pago" | "stripe";
  payment_method: PaymentMethodType;
  payment_status: PaymentStatus;
  access_status: ProductAccessStatus;
  gateway_payment_id: string | null;
  access_granted_at: Date | string | null;
  gateway_synced_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  webhook_count: number | string;
  download_count: number | string;
  account_created: boolean;
};

type AuditRow = {
  id: number | string;
  level: "info" | "warn" | "error";
  event: string;
  actor_type: "system" | "admin" | "customer" | "gateway";
  entity_type: string;
  entity_id: string | null;
  order_id: string | null;
  gateway_payment_id: string | null;
  status: string | null;
  request_id: string;
  source: string;
  latency_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
};

type WebhookRow = {
  event_key: string;
  gateway_event_id: string | null;
  event_type: string | null;
  external_reference: string;
  gateway_payment_id: string;
  received_at: Date | string;
  processed_at: Date | string | null;
  result: string | null;
  latency_ms: number | null;
  payload_summary: Record<string, unknown> | null;
};

const EMPTY_METRICS: AdminMetrics = {
  checkoutStarted: 0,
  totalSales: 0,
  totalRevenue: 0,
  revenueToday: 0,
  pendingOrders: 0,
  approvedOrders: 0,
  cancelledOrders: 0,
  expiredOrders: 0,
  refunds: 0,
  chargebacks: 0,
  conversionRate: 0,
  abandonedCheckouts: 0,
  customers: 0,
  downloads: 0,
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toAdminOrder(row: OrderRow): AdminOrder {
  const base: OrderRecord = {
    externalReference: row.external_reference,
    productSlug: row.product_slug,
    amount: row.amount_cents / 100,
    currency: row.currency,
    payerEmail: row.payer_email,
    payerName: row.payer_name ?? undefined,
    gateway: row.payment_gateway,
    method: row.payment_method,
    status: row.payment_status,
    accessStatus: row.access_status,
    gatewayPaymentId: row.gateway_payment_id ?? undefined,
    accessGrantedAt: row.access_granted_at ? iso(row.access_granted_at) : undefined,
    gatewaySyncedAt: row.gateway_synced_at ? iso(row.gateway_synced_at) : undefined,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
  return {
    ...base,
    webhookCount: numberValue(row.webhook_count),
    downloadCount: numberValue(row.download_count),
    accountCreated: row.account_created,
  };
}

function toAuditEvent(row: AuditRow): AuditEvent {
  return {
    id: String(row.id),
    level: row.level,
    event: row.event,
    actorType: row.actor_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    orderId: row.order_id,
    gatewayPaymentId: row.gateway_payment_id,
    status: row.status,
    requestId: row.request_id,
    source: row.source,
    latencyMs: row.latency_ms,
    metadata: row.metadata ?? {},
    createdAt: iso(row.created_at),
  };
}

function toWebhookEvent(row: WebhookRow): WebhookEvent {
  return {
    id: row.event_key,
    eventId: row.gateway_event_id,
    eventType: row.event_type,
    orderId: row.external_reference,
    gatewayPaymentId: row.gateway_payment_id,
    receivedAt: iso(row.received_at),
    processedAt: row.processed_at ? iso(row.processed_at) : null,
    result: row.result ?? (row.processed_at ? "processed" : "received"),
    latencyMs: row.latency_ms,
    payload: row.payload_summary ?? {},
  };
}

class InMemoryAdminStore implements AdminStore {
  private readonly sessions = new Map<string, AdminSession>();
  private readonly attempts: Array<{ fingerprint: string; succeeded: boolean; at: number }> = [];
  private readonly audit: AuditEvent[] = [];

  async createSession(tokenHash: string, emailHash: string, expiresAt: string): Promise<AdminSession> {
    const session = { id: randomUUID(), emailHash, expiresAt };
    this.sessions.set(tokenHash, session);
    return session;
  }

  async getSession(tokenHash: string): Promise<AdminSession | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
    return { ...session };
  }

  async revokeSession(tokenHash: string): Promise<void> { this.sessions.delete(tokenHash); }

  async countRecentFailedLogins(fingerprintHash: string, windowMinutes: number): Promise<number> {
    const threshold = Date.now() - windowMinutes * 60_000;
    return this.attempts.filter((item) => item.fingerprint === fingerprintHash && !item.succeeded && item.at >= threshold).length;
  }

  async recordLoginAttempt(fingerprintHash: string, succeeded: boolean): Promise<void> {
    this.attempts.push({ fingerprint: fingerprintHash, succeeded, at: Date.now() });
  }

  async getMetrics(): Promise<AdminMetrics> { return { ...EMPTY_METRICS }; }
  async listOrders(filters: OrderFilters): Promise<PaginatedOrders> { return { items: [], page: filters.page, pageSize: filters.pageSize, total: 0, totalPages: 1 }; }
  async getOrderDetail(): Promise<OrderDetail | null> { return null; }
  async listCustomers(): Promise<{ items: AdminCustomer[]; total: number; totalPages: number }> { return { items: [], total: 0, totalPages: 1 }; }
  async listWebhooks(): Promise<{ items: WebhookEvent[]; total: number; totalPages: number }> { return { items: [], total: 0, totalPages: 1 }; }
  async listAuditEvents(query: string, level: string, page: number, pageSize: number): Promise<{ items: AuditEvent[]; total: number; totalPages: number }> {
    const normalized = query.toLowerCase();
    const filtered = this.audit.filter((item) => (!level || item.level === level) && (!normalized || JSON.stringify(item).toLowerCase().includes(normalized)));
    return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)) };
  }
  async getSalesSeries(): Promise<SalesPoint[]> { return []; }
  async recordAudit(input: AuditInput): Promise<void> {
    this.audit.unshift({ ...input, id: randomUUID(), metadata: input.metadata ?? {}, createdAt: new Date().toISOString() });
  }
  async recordDownload(): Promise<void> { return; }
  async enrichWebhook(): Promise<void> { return; }
}

class PostgresAdminStore implements AdminStore {
  private readonly sql: postgres.Sql;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false, onnotice: () => undefined });
  }

  private async run<T>(message: string, operation: () => Promise<T>): Promise<T> {
    try { return await operation(); } catch (error) { throw new AdminStoreUnavailableError(message, error); }
  }

  async createSession(tokenHash: string, emailHash: string, expiresAt: string): Promise<AdminSession> {
    return this.run("Falha ao criar sessão administrativa.", async () => {
      const id = randomUUID();
      await this.sql`INSERT INTO admin_sessions (id, token_hash, admin_email_hash, expires_at) VALUES (${id}, ${tokenHash}, ${emailHash}, ${expiresAt})`;
      return { id, emailHash, expiresAt };
    });
  }

  async getSession(tokenHash: string): Promise<AdminSession | null> {
    return this.run("Falha ao validar sessão administrativa.", async () => {
      const rows = await this.sql<{ id: string; admin_email_hash: string; expires_at: Date | string }[]>`
        UPDATE admin_sessions SET last_seen_at = NOW()
        WHERE token_hash = ${tokenHash} AND revoked_at IS NULL AND expires_at > NOW()
        RETURNING id, admin_email_hash, expires_at
      `;
      return rows[0] ? { id: rows[0].id, emailHash: rows[0].admin_email_hash, expiresAt: iso(rows[0].expires_at) } : null;
    });
  }

  async revokeSession(tokenHash: string): Promise<void> {
    return this.run("Falha ao encerrar sessão administrativa.", async () => { await this.sql`UPDATE admin_sessions SET revoked_at = NOW() WHERE token_hash = ${tokenHash} AND revoked_at IS NULL`; });
  }

  async countRecentFailedLogins(fingerprintHash: string, windowMinutes: number): Promise<number> {
    return this.run("Falha ao validar tentativas de acesso.", async () => {
      const rows = await this.sql<{ total: number | string }[]>`
        SELECT COUNT(*) AS total FROM admin_login_attempts
        WHERE fingerprint_hash = ${fingerprintHash} AND succeeded = FALSE
          AND attempted_at >= NOW() - (${windowMinutes} * INTERVAL '1 minute')
      `;
      return numberValue(rows[0]?.total);
    });
  }

  async recordLoginAttempt(fingerprintHash: string, succeeded: boolean): Promise<void> {
    return this.run("Falha ao registrar tentativa de acesso.", async () => { await this.sql`INSERT INTO admin_login_attempts (fingerprint_hash, succeeded) VALUES (${fingerprintHash}, ${succeeded})`; });
  }

  async getMetrics(): Promise<AdminMetrics> {
    return this.run("Falha ao carregar métricas administrativas.", async () => {
      const rows = await this.sql<Record<string, number | string>[]>`
        SELECT
          COUNT(*) AS checkout_started,
          COUNT(*) FILTER (WHERE payment_status = 'approved') AS total_sales,
          COALESCE(SUM(amount_cents) FILTER (WHERE payment_status = 'approved'), 0) AS total_revenue_cents,
          COALESCE(SUM(amount_cents) FILTER (WHERE payment_status = 'approved' AND updated_at >= CURRENT_DATE), 0) AS revenue_today_cents,
          COUNT(*) FILTER (WHERE payment_status IN ('pending', 'in_process')) AS pending_orders,
          COUNT(*) FILTER (WHERE payment_status = 'approved') AS approved_orders,
          COUNT(*) FILTER (WHERE payment_status = 'cancelled') AS cancelled_orders,
          COUNT(*) FILTER (WHERE payment_status = 'refunded') AS refunds,
          COUNT(*) FILTER (WHERE payment_status = 'charged_back') AS chargebacks
        FROM payment_orders
      `;
      const extras = await this.sql<{ expired: number | string; downloads: number | string; customers: number | string }[]>`
        SELECT
          (SELECT COUNT(DISTINCT order_id) FROM operational_audit_events WHERE event = 'checkout.expired') AS expired,
          (SELECT COUNT(*) FROM product_download_events WHERE result = 'authorized') AS downloads,
          (SELECT COUNT(*) FROM customer_accounts) AS customers
      `;
      const row = rows[0] ?? {};
      const checkoutStarted = numberValue(row.checkout_started);
      const approvedOrders = numberValue(row.approved_orders);
      const cancelledOrders = numberValue(row.cancelled_orders);
      const expiredOrders = numberValue(extras[0]?.expired);
      return {
        checkoutStarted,
        totalSales: numberValue(row.total_sales),
        totalRevenue: numberValue(row.total_revenue_cents) / 100,
        revenueToday: numberValue(row.revenue_today_cents) / 100,
        pendingOrders: numberValue(row.pending_orders),
        approvedOrders,
        cancelledOrders,
        expiredOrders,
        refunds: numberValue(row.refunds),
        chargebacks: numberValue(row.chargebacks),
        conversionRate: checkoutStarted ? (approvedOrders / checkoutStarted) * 100 : 0,
        abandonedCheckouts: Math.max(0, cancelledOrders + expiredOrders),
        customers: numberValue(extras[0]?.customers),
        downloads: numberValue(extras[0]?.downloads),
      };
    });
  }

  async listOrders(filters: OrderFilters): Promise<PaginatedOrders> {
    return this.run("Falha ao carregar pedidos.", async () => {
      const query = filters.query?.trim() || null;
      const status = filters.status ?? null;
      const product = filters.productSlug?.trim() || null;
      const email = filters.email?.trim() || null;
      const from = filters.dateFrom || null;
      const to = filters.dateTo || null;
      const min = filters.minAmount === undefined ? null : Math.round(filters.minAmount * 100);
      const max = filters.maxAmount === undefined ? null : Math.round(filters.maxAmount * 100);
      const offset = (filters.page - 1) * filters.pageSize;
      const countRows = await this.sql<{ total: number | string }[]>`
        SELECT COUNT(*) AS total FROM payment_orders orders
        WHERE (${status}::text IS NULL OR orders.payment_status = ${status})
          AND (${product}::text IS NULL OR orders.product_slug = ${product})
          AND (${email}::text IS NULL OR orders.payer_email ILIKE '%' || ${email} || '%')
          AND (${from}::text IS NULL OR orders.created_at >= ${from}::date)
          AND (${to}::text IS NULL OR orders.created_at < ${to}::date + INTERVAL '1 day')
          AND (${min}::integer IS NULL OR orders.amount_cents >= ${min})
          AND (${max}::integer IS NULL OR orders.amount_cents <= ${max})
          AND (${query}::text IS NULL OR CONCAT_WS(' ', orders.external_reference::text, orders.payer_email, orders.payer_name, orders.product_slug, orders.gateway_payment_id) ILIKE '%' || ${query} || '%')
      `;
      const rows = await this.sql<OrderRow[]>`
        SELECT orders.*,
          (SELECT COUNT(*) FROM payment_webhook_events webhooks WHERE webhooks.external_reference = orders.external_reference) AS webhook_count,
          (SELECT COUNT(*) FROM product_download_events downloads WHERE downloads.order_id = orders.external_reference AND downloads.result = 'authorized') AS download_count,
          EXISTS(SELECT 1 FROM customer_accounts accounts WHERE accounts.email_normalized = LOWER(orders.payer_email)) AS account_created
        FROM payment_orders orders
        WHERE (${status}::text IS NULL OR orders.payment_status = ${status})
          AND (${product}::text IS NULL OR orders.product_slug = ${product})
          AND (${email}::text IS NULL OR orders.payer_email ILIKE '%' || ${email} || '%')
          AND (${from}::text IS NULL OR orders.created_at >= ${from}::date)
          AND (${to}::text IS NULL OR orders.created_at < ${to}::date + INTERVAL '1 day')
          AND (${min}::integer IS NULL OR orders.amount_cents >= ${min})
          AND (${max}::integer IS NULL OR orders.amount_cents <= ${max})
          AND (${query}::text IS NULL OR CONCAT_WS(' ', orders.external_reference::text, orders.payer_email, orders.payer_name, orders.product_slug, orders.gateway_payment_id) ILIKE '%' || ${query} || '%')
        ORDER BY orders.created_at DESC
        LIMIT ${filters.pageSize} OFFSET ${offset}
      `;
      const total = numberValue(countRows[0]?.total);
      return { items: rows.map(toAdminOrder), page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.max(1, Math.ceil(total / filters.pageSize)) };
    });
  }

  async getOrderDetail(orderId: string): Promise<OrderDetail | null> {
    return this.run("Falha ao carregar o pedido.", async () => {
      const rows = await this.sql<OrderRow[]>`
        SELECT orders.*,
          (SELECT COUNT(*) FROM payment_webhook_events webhooks WHERE webhooks.external_reference = orders.external_reference) AS webhook_count,
          (SELECT COUNT(*) FROM product_download_events downloads WHERE downloads.order_id = orders.external_reference AND downloads.result = 'authorized') AS download_count,
          EXISTS(SELECT 1 FROM customer_accounts accounts WHERE accounts.email_normalized = LOWER(orders.payer_email)) AS account_created
        FROM payment_orders orders WHERE external_reference = ${orderId}
      `;
      if (!rows[0]) return null;
      const auditRows = await this.sql<AuditRow[]>`SELECT * FROM operational_audit_events WHERE order_id = ${orderId} ORDER BY created_at ASC`;
      const webhookRows = await this.sql<WebhookRow[]>`SELECT * FROM payment_webhook_events WHERE external_reference = ${orderId} ORDER BY received_at DESC`;
      const loginRows = await this.sql<{ last_seen_at: Date | string | null }[]>`
        SELECT MAX(sessions.last_seen_at) AS last_seen_at
        FROM customer_sessions sessions INNER JOIN customer_accounts accounts ON accounts.id = sessions.account_id
        WHERE accounts.email_normalized = LOWER(${rows[0].payer_email})
      `;
      return {
        order: toAdminOrder(rows[0]),
        customerLastLoginAt: loginRows[0]?.last_seen_at ? iso(loginRows[0].last_seen_at) : null,
        timeline: auditRows.map(toAuditEvent),
        webhooks: webhookRows.map(toWebhookEvent),
      };
    });
  }

  async listCustomers(query: string, page: number, pageSize: number): Promise<{ items: AdminCustomer[]; total: number; totalPages: number }> {
    return this.run("Falha ao carregar clientes.", async () => {
      const normalized = query.trim() || null;
      const offset = (page - 1) * pageSize;
      const countRows = await this.sql<{ total: number | string }[]>`
        SELECT COUNT(DISTINCT LOWER(payer_email)) AS total FROM payment_orders
        WHERE (${normalized}::text IS NULL OR CONCAT_WS(' ', payer_email, payer_name, product_slug) ILIKE '%' || ${normalized} || '%')
      `;
      const rows = await this.sql<Array<{
        email: string; name: string | null; products: string[]; first_purchase_at: Date | string; last_purchase_at: Date | string;
        last_login_at: Date | string | null; downloads: number | string; approved_orders: number | string; total_orders: number | string;
      }>>`
        SELECT LOWER(orders.payer_email) AS email, MAX(orders.payer_name) AS name,
          ARRAY_AGG(DISTINCT orders.product_slug ORDER BY orders.product_slug) AS products,
          MIN(orders.created_at) AS first_purchase_at, MAX(orders.created_at) AS last_purchase_at,
          MAX(sessions.last_seen_at) AS last_login_at,
          COUNT(DISTINCT downloads.id) FILTER (WHERE downloads.result = 'authorized') AS downloads,
          COUNT(DISTINCT orders.external_reference) FILTER (WHERE orders.payment_status = 'approved') AS approved_orders,
          COUNT(DISTINCT orders.external_reference) AS total_orders
        FROM payment_orders orders
        LEFT JOIN customer_accounts accounts ON accounts.email_normalized = LOWER(orders.payer_email)
        LEFT JOIN customer_sessions sessions ON sessions.account_id = accounts.id
        LEFT JOIN product_download_events downloads ON downloads.order_id = orders.external_reference
        WHERE (${normalized}::text IS NULL OR CONCAT_WS(' ', orders.payer_email, orders.payer_name, orders.product_slug) ILIKE '%' || ${normalized} || '%')
        GROUP BY LOWER(orders.payer_email)
        ORDER BY MAX(orders.created_at) DESC LIMIT ${pageSize} OFFSET ${offset}
      `;
      const total = numberValue(countRows[0]?.total);
      return {
        items: rows.map((row) => ({ email: row.email, name: row.name, products: row.products, firstPurchaseAt: iso(row.first_purchase_at), lastPurchaseAt: iso(row.last_purchase_at), lastLoginAt: row.last_login_at ? iso(row.last_login_at) : null, downloads: numberValue(row.downloads), approvedOrders: numberValue(row.approved_orders), totalOrders: numberValue(row.total_orders) })),
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    });
  }

  async listWebhooks(query: string, page: number, pageSize: number): Promise<{ items: WebhookEvent[]; total: number; totalPages: number }> {
    return this.run("Falha ao carregar webhooks.", async () => {
      const normalized = query.trim() || null;
      const offset = (page - 1) * pageSize;
      const countRows = await this.sql<{ total: number | string }[]>`SELECT COUNT(*) AS total FROM payment_webhook_events WHERE (${normalized}::text IS NULL OR CONCAT_WS(' ', event_key, gateway_event_id, event_type, external_reference::text, gateway_payment_id, result) ILIKE '%' || ${normalized} || '%')`;
      const rows = await this.sql<WebhookRow[]>`SELECT * FROM payment_webhook_events WHERE (${normalized}::text IS NULL OR CONCAT_WS(' ', event_key, gateway_event_id, event_type, external_reference::text, gateway_payment_id, result) ILIKE '%' || ${normalized} || '%') ORDER BY received_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
      const total = numberValue(countRows[0]?.total);
      return { items: rows.map(toWebhookEvent), total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    });
  }

  async listAuditEvents(query: string, level: string, page: number, pageSize: number): Promise<{ items: AuditEvent[]; total: number; totalPages: number }> {
    return this.run("Falha ao carregar logs operacionais.", async () => {
      const normalized = query.trim() || null;
      const normalizedLevel = ["info", "warn", "error"].includes(level) ? level : null;
      const offset = (page - 1) * pageSize;
      const countRows = await this.sql<{ total: number | string }[]>`SELECT COUNT(*) AS total FROM operational_audit_events WHERE (${normalizedLevel}::text IS NULL OR level = ${normalizedLevel}) AND (${normalized}::text IS NULL OR CONCAT_WS(' ', event, entity_id, order_id::text, gateway_payment_id, status, request_id, source) ILIKE '%' || ${normalized} || '%')`;
      const rows = await this.sql<AuditRow[]>`SELECT * FROM operational_audit_events WHERE (${normalizedLevel}::text IS NULL OR level = ${normalizedLevel}) AND (${normalized}::text IS NULL OR CONCAT_WS(' ', event, entity_id, order_id::text, gateway_payment_id, status, request_id, source) ILIKE '%' || ${normalized} || '%') ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
      const total = numberValue(countRows[0]?.total);
      return { items: rows.map(toAuditEvent), total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    });
  }

  async getSalesSeries(days: number): Promise<SalesPoint[]> {
    return this.run("Falha ao carregar estatísticas.", async () => {
      const rows = await this.sql<Array<{ date: Date | string; sales: number | string; revenue_cents: number | string; checkouts: number | string; abandoned: number | string; downloads: number | string; customers: number | string }>>`
        WITH
          dates AS (
            SELECT generate_series(CURRENT_DATE - (${days - 1} * INTERVAL '1 day'), CURRENT_DATE, INTERVAL '1 day')::date AS date
          ),
          orders_by_day AS (
            SELECT created_at::date AS date,
              COUNT(*) FILTER (WHERE payment_status = 'approved') AS sales,
              COALESCE(SUM(amount_cents) FILTER (WHERE payment_status = 'approved'), 0) AS revenue_cents,
              COUNT(*) AS checkouts,
              COUNT(*) FILTER (WHERE payment_status IN ('cancelled', 'rejected')) AS abandoned
            FROM payment_orders
            WHERE created_at >= CURRENT_DATE - (${days - 1} * INTERVAL '1 day')
            GROUP BY created_at::date
          ),
          downloads_by_day AS (
            SELECT created_at::date AS date, COUNT(*) AS downloads
            FROM product_download_events
            WHERE result = 'authorized' AND created_at >= CURRENT_DATE - (${days - 1} * INTERVAL '1 day')
            GROUP BY created_at::date
          ),
          customers_by_day AS (
            SELECT created_at::date AS date, COUNT(*) AS customers
            FROM customer_accounts
            WHERE created_at >= CURRENT_DATE - (${days - 1} * INTERVAL '1 day')
            GROUP BY created_at::date
          )
        SELECT dates.date,
          COALESCE(orders.sales, 0) AS sales,
          COALESCE(orders.revenue_cents, 0) AS revenue_cents,
          COALESCE(orders.checkouts, 0) AS checkouts,
          COALESCE(orders.abandoned, 0) AS abandoned,
          COALESCE(downloads.downloads, 0) AS downloads,
          COALESCE(customers.customers, 0) AS customers
        FROM dates
        LEFT JOIN orders_by_day orders USING (date)
        LEFT JOIN downloads_by_day downloads USING (date)
        LEFT JOIN customers_by_day customers USING (date)
        ORDER BY dates.date ASC
      `;
      return rows.map((row) => ({ date: iso(row.date), sales: numberValue(row.sales), revenue: numberValue(row.revenue_cents) / 100, checkouts: numberValue(row.checkouts), abandoned: numberValue(row.abandoned), downloads: numberValue(row.downloads), customers: numberValue(row.customers) }));
    });
  }

  async recordAudit(input: AuditInput): Promise<void> {
    return this.run("Falha ao registrar auditoria.", async () => {
      await this.sql`
        INSERT INTO operational_audit_events (level, event, actor_type, actor_id_hash, entity_type, entity_id, order_id, gateway_payment_id, status, request_id, source, latency_ms, metadata)
        VALUES (${input.level}, ${input.event}, ${input.actorType}, ${input.actorIdHash ?? null}, ${input.entityType}, ${input.entityId}, ${input.orderId}, ${input.gatewayPaymentId}, ${input.status}, ${input.requestId}, ${input.source}, ${input.latencyMs}, ${this.sql.json(input.metadata ?? {})})
      `;
    });
  }

  async recordDownload(input: { orderId: string; accountId?: string; requestId: string; source: string; result: string }): Promise<void> {
    return this.run("Falha ao registrar download.", async () => {
      await this.sql`INSERT INTO product_download_events (order_id, account_id, request_id, source, result) VALUES (${input.orderId}, ${input.accountId ?? null}, ${input.requestId}, ${input.source}, ${input.result})`;
    });
  }

  async enrichWebhook(input: { eventKey: string; eventId: string; eventType: string; result: string; latencyMs: number; payload: Record<string, string | number | boolean | null> }): Promise<void> {
    return this.run("Falha ao enriquecer webhook.", async () => {
      await this.sql`UPDATE payment_webhook_events SET gateway_event_id = ${input.eventId}, event_type = ${input.eventType}, result = ${input.result}, latency_ms = ${input.latencyMs}, payload_summary = ${this.sql.json(input.payload)} WHERE event_key = ${input.eventKey}`;
    });
  }
}

const globalForAdminStore = globalThis as unknown as { __escalaHubAdminStore?: AdminStore };

export function getAdminStore(): AdminStore {
  if (globalForAdminStore.__escalaHubAdminStore) return globalForAdminStore.__escalaHubAdminStore;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) throw new AdminStoreUnavailableError("DATABASE_URL inválida.");
    globalForAdminStore.__escalaHubAdminStore = new PostgresAdminStore(databaseUrl);
  } else if (process.env.NODE_ENV === "production") {
    throw new AdminStoreUnavailableError("DATABASE_URL não configurada.");
  } else {
    globalForAdminStore.__escalaHubAdminStore = new InMemoryAdminStore();
  }
  return globalForAdminStore.__escalaHubAdminStore;
}
