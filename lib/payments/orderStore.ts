import postgres from "postgres";
import type { PaymentMethodType, PaymentStatus } from "./types";

export type ProductAccessStatus = "pending" | "granted" | "revoked";

export type OrderRecord = {
  externalReference: string;
  productSlug: string;
  amount: number;
  currency: string;
  payerEmail: string;
  payerName?: string;
  gateway: "mercado_pago" | "stripe";
  method: PaymentMethodType;
  status: PaymentStatus;
  accessStatus: ProductAccessStatus;
  gatewayPaymentId?: string;
  accessGrantedAt?: string;
  gatewaySyncedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentUpdate = {
  externalReference: string;
  gatewayPaymentId: string;
  status: PaymentStatus;
  webhookEventKey?: string;
};

export type PaymentUpdateResult = {
  order: OrderRecord | null;
  duplicate: boolean;
};

export interface OrderStore {
  create(record: OrderRecord): Promise<boolean>;
  applyPaymentUpdate(update: PaymentUpdate): Promise<PaymentUpdateResult>;
  claimGatewaySync(externalReference: string, minimumIntervalMs: number): Promise<boolean>;
  getByExternalReference(externalReference: string): Promise<OrderRecord | null>;
  listByPayerEmail(payerEmail: string): Promise<OrderRecord[]>;
}

export class OrderStoreUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "OrderStoreUnavailableError";
  }
}

function canTransition(current: PaymentStatus, next: PaymentStatus): boolean {
  if (current === next) return true;
  if (current === "approved") return next === "refunded" || next === "charged_back";
  if (current === "rejected") return next === "cancelled";
  if (current === "cancelled" || current === "refunded" || current === "charged_back") return false;
  return true;
}

function accessAfterPayment(current: ProductAccessStatus, nextStatus: PaymentStatus): ProductAccessStatus {
  if (nextStatus === "approved") return "granted";
  if (nextStatus === "refunded" || nextStatus === "charged_back") return "revoked";
  return current;
}

class InMemoryOrderStore implements OrderStore {
  private readonly ordersByReference = new Map<string, OrderRecord>();
  private readonly referenceByGatewayId = new Map<string, string>();
  private readonly webhookEvents = new Set<string>();

  async create(record: OrderRecord): Promise<boolean> {
    if (this.ordersByReference.has(record.externalReference)) return false;
    this.ordersByReference.set(record.externalReference, { ...record });
    if (record.gatewayPaymentId) this.referenceByGatewayId.set(record.gatewayPaymentId, record.externalReference);
    return true;
  }

  async applyPaymentUpdate(update: PaymentUpdate): Promise<PaymentUpdateResult> {
    if (update.webhookEventKey && this.webhookEvents.has(update.webhookEventKey)) {
      return { order: await this.getByExternalReference(update.externalReference), duplicate: true };
    }

    const order = this.ordersByReference.get(update.externalReference);
    const mappedReference = this.referenceByGatewayId.get(update.gatewayPaymentId);
    if (!order || (order.gatewayPaymentId && order.gatewayPaymentId !== update.gatewayPaymentId) || (mappedReference && mappedReference !== update.externalReference)) {
      return { order: null, duplicate: false };
    }

    const nextStatus = canTransition(order.status, update.status) ? update.status : order.status;
    const nextAccessStatus = accessAfterPayment(order.accessStatus, nextStatus);
    const now = new Date().toISOString();
    order.gatewayPaymentId = update.gatewayPaymentId;
    order.status = nextStatus;
    order.accessStatus = nextAccessStatus;
    order.accessGrantedAt = nextAccessStatus === "granted" ? (order.accessGrantedAt ?? now) : order.accessGrantedAt;
    order.gatewaySyncedAt = now;
    order.updatedAt = now;
    this.referenceByGatewayId.set(update.gatewayPaymentId, update.externalReference);
    if (update.webhookEventKey) this.webhookEvents.add(update.webhookEventKey);
    return { order: { ...order }, duplicate: false };
  }

  async claimGatewaySync(externalReference: string, minimumIntervalMs: number): Promise<boolean> {
    const order = this.ordersByReference.get(externalReference);
    if (!order || !order.gatewayPaymentId || (order.status !== "pending" && order.status !== "in_process")) return false;
    const lastSync = order.gatewaySyncedAt ? Date.parse(order.gatewaySyncedAt) : 0;
    if (Date.now() - lastSync < minimumIntervalMs) return false;
    order.gatewaySyncedAt = new Date().toISOString();
    return true;
  }

  async getByExternalReference(externalReference: string): Promise<OrderRecord | null> {
    const order = this.ordersByReference.get(externalReference);
    return order ? { ...order } : null;
  }

  async listByPayerEmail(payerEmail: string): Promise<OrderRecord[]> {
    const normalizedEmail = payerEmail.trim().toLowerCase();
    return [...this.ordersByReference.values()]
      .filter((order) => order.payerEmail.trim().toLowerCase() === normalizedEmail)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map((order) => ({ ...order }));
  }

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
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToOrder(row: OrderRow): OrderRecord {
  return {
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
    accessGrantedAt: row.access_granted_at ? toIsoString(row.access_granted_at) : undefined,
    gatewaySyncedAt: row.gateway_synced_at ? toIsoString(row.gateway_synced_at) : undefined,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

class PostgresOrderStore implements OrderStore {
  private readonly sql: postgres.Sql;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      onnotice: () => undefined,
    });
  }

  async create(record: OrderRecord): Promise<boolean> {
    try {
      const rows = await this.sql<{ external_reference: string }[]>`
        INSERT INTO payment_orders (
          external_reference, product_slug, amount_cents, currency, payer_email, payer_name,
          payment_method, payment_status, access_status, gateway_payment_id,
          payment_gateway, access_granted_at, gateway_synced_at, created_at, updated_at
        ) VALUES (
          ${record.externalReference}, ${record.productSlug}, ${Math.round(record.amount * 100)},
          ${record.currency}, ${record.payerEmail}, ${record.payerName ?? null}, ${record.method}, ${record.status},
          ${record.accessStatus}, ${record.gatewayPaymentId ?? null}, ${record.gateway}, ${record.accessGrantedAt ?? null},
          ${record.gatewaySyncedAt ?? null}, ${record.createdAt}, ${record.updatedAt}
        )
        ON CONFLICT (external_reference) DO NOTHING
        RETURNING external_reference
      `;
      return rows.length === 1;
    } catch (error) {
      throw new OrderStoreUnavailableError("Falha ao persistir o pedido.", error);
    }
  }

  async applyPaymentUpdate(update: PaymentUpdate): Promise<PaymentUpdateResult> {
    try {
      return await this.sql.begin(async (transaction) => {
        if (update.webhookEventKey) {
          const inserted = await transaction<{ event_key: string }[]>`
            INSERT INTO payment_webhook_events (event_key, external_reference, gateway_payment_id)
            VALUES (${update.webhookEventKey}, ${update.externalReference}, ${update.gatewayPaymentId})
            ON CONFLICT (event_key) DO NOTHING
            RETURNING event_key
          `;
          if (inserted.length === 0) {
            const duplicateRows = await transaction<OrderRow[]>`
              SELECT * FROM payment_orders WHERE external_reference = ${update.externalReference}
            `;
            return { order: duplicateRows[0] ? rowToOrder(duplicateRows[0]) : null, duplicate: true };
          }
        }

        const currentRows = await transaction<OrderRow[]>`
          SELECT *
          FROM payment_orders
          WHERE external_reference = ${update.externalReference}
          FOR UPDATE
        `;
        const current = currentRows[0];
        if (!current || (current.gateway_payment_id && current.gateway_payment_id !== update.gatewayPaymentId)) {
          return { order: null, duplicate: false };
        }

        const collisionRows = await transaction<{ external_reference: string }[]>`
          SELECT external_reference
          FROM payment_orders
          WHERE gateway_payment_id = ${update.gatewayPaymentId}
            AND external_reference <> ${update.externalReference}
          LIMIT 1
        `;
        if (collisionRows.length > 0) {
          return { order: null, duplicate: false };
        }

        const nextStatus = canTransition(current.payment_status, update.status) ? update.status : current.payment_status;
        const nextAccessStatus = accessAfterPayment(current.access_status, nextStatus);
        const rows = await transaction<OrderRow[]>`
          UPDATE payment_orders
          SET gateway_payment_id = ${update.gatewayPaymentId},
              payment_status = ${nextStatus},
              access_status = ${nextAccessStatus},
              access_granted_at = CASE
                WHEN ${nextAccessStatus} = 'granted' THEN COALESCE(access_granted_at, NOW())
                ELSE access_granted_at
              END,
              gateway_synced_at = NOW(),
              updated_at = NOW()
          WHERE external_reference = ${update.externalReference}
          RETURNING *
        `;
        if (update.webhookEventKey) {
          await transaction`
            UPDATE payment_webhook_events
            SET processed_at = NOW()
            WHERE event_key = ${update.webhookEventKey}
          `;
        }
        return { order: rows[0] ? rowToOrder(rows[0]) : null, duplicate: false };
      });
    } catch (error) {
      throw new OrderStoreUnavailableError("Falha ao reconciliar o pagamento.", error);
    }
  }

  async claimGatewaySync(externalReference: string, minimumIntervalMs: number): Promise<boolean> {
    try {
      const rows = await this.sql<{ external_reference: string }[]>`
        UPDATE payment_orders
        SET gateway_synced_at = NOW()
        WHERE external_reference = ${externalReference}
          AND gateway_payment_id IS NOT NULL
          AND payment_status IN ('pending', 'in_process')
          AND (gateway_synced_at IS NULL OR gateway_synced_at <= NOW() - (${minimumIntervalMs} * INTERVAL '1 millisecond'))
        RETURNING external_reference
      `;
      return rows.length === 1;
    } catch (error) {
      throw new OrderStoreUnavailableError("Falha ao reservar a sincronização do pagamento.", error);
    }
  }

  async getByExternalReference(externalReference: string): Promise<OrderRecord | null> {
    try {
      const rows = await this.sql<OrderRow[]>`
        SELECT * FROM payment_orders WHERE external_reference = ${externalReference}
      `;
      return rows[0] ? rowToOrder(rows[0]) : null;
    } catch (error) {
      throw new OrderStoreUnavailableError("Falha ao consultar o pedido.", error);
    }
  }

  async listByPayerEmail(payerEmail: string): Promise<OrderRecord[]> {
    try {
      const rows = await this.sql<OrderRow[]>`
        SELECT *
        FROM payment_orders
        WHERE LOWER(payer_email) = ${payerEmail.trim().toLowerCase()}
        ORDER BY created_at DESC
      `;
      return rows.map(rowToOrder);
    } catch (error) {
      throw new OrderStoreUnavailableError("Falha ao consultar os pedidos do cliente.", error);
    }
  }

}

const globalForOrderStore = globalThis as unknown as { __escalaHubOrderStore?: OrderStore };

export function getOrderStore(): OrderStore {
  if (globalForOrderStore.__escalaHubOrderStore) return globalForOrderStore.__escalaHubOrderStore;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
      throw new OrderStoreUnavailableError("DATABASE_URL inválida.");
    }
    globalForOrderStore.__escalaHubOrderStore = new PostgresOrderStore(databaseUrl);
    return globalForOrderStore.__escalaHubOrderStore;
  }

  if (process.env.NODE_ENV === "production") {
    throw new OrderStoreUnavailableError("DATABASE_URL não configurada.");
  }

  globalForOrderStore.__escalaHubOrderStore = new InMemoryOrderStore();
  return globalForOrderStore.__escalaHubOrderStore;
}
