import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { OrderRecord } from "@/lib/payments/orderStore";
import type { CustomerProfile, CustomerSession } from "./types";

export class AccountStoreUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AccountStoreUnavailableError";
  }
}

export interface AccountStore {
  ensureAccount(order: OrderRecord): Promise<CustomerProfile>;
  createSession(order: OrderRecord, tokenHash: string, expiresAt: string): Promise<CustomerSession>;
  getSession(tokenHash: string): Promise<CustomerSession | null>;
  revokeSession(tokenHash: string): Promise<void>;
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

class InMemoryAccountStore implements AccountStore {
  private readonly accountsByEmail = new Map<string, CustomerProfile>();
  private readonly sessionsByHash = new Map<string, CustomerSession>();

  async ensureAccount(order: OrderRecord): Promise<CustomerProfile> {
    const email = normalizedEmail(order.payerEmail);
    const profile = this.accountsByEmail.get(email) ?? {
      id: randomUUID(),
      name: order.payerName?.trim() || null,
      email: order.payerEmail,
      photoUrl: null,
    };
    if (!profile.name && order.payerName?.trim()) profile.name = order.payerName.trim();
    this.accountsByEmail.set(email, profile);
    return { ...profile };
  }

  async createSession(order: OrderRecord, tokenHash: string, expiresAt: string): Promise<CustomerSession> {
    const profile = await this.ensureAccount(order);
    const session = { id: randomUUID(), profile: { ...profile }, expiresAt };
    this.sessionsByHash.set(tokenHash, session);
    return session;
  }

  async getSession(tokenHash: string): Promise<CustomerSession | null> {
    const session = this.sessionsByHash.get(tokenHash);
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      this.sessionsByHash.delete(tokenHash);
      return null;
    }
    return { ...session, profile: { ...session.profile } };
  }

  async revokeSession(tokenHash: string): Promise<void> {
    this.sessionsByHash.delete(tokenHash);
  }
}

type SessionRow = {
  session_id: string;
  account_id: string;
  email: string;
  name: string | null;
  photo_url: string | null;
  expires_at: Date | string;
};

function toSession(row: SessionRow): CustomerSession {
  return {
    id: row.session_id,
    profile: { id: row.account_id, email: row.email, name: row.name, photoUrl: row.photo_url },
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

class PostgresAccountStore implements AccountStore {
  private readonly sql: postgres.Sql;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, { max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false, onnotice: () => undefined });
  }

  async ensureAccount(order: OrderRecord): Promise<CustomerProfile> {
    try {
      const rows = await this.sql<{ id: string; email: string; name: string | null; photo_url: string | null }[]>`
        INSERT INTO customer_accounts (id, email, email_normalized, name)
        VALUES (${randomUUID()}, ${order.payerEmail}, ${normalizedEmail(order.payerEmail)}, ${order.payerName?.trim() || null})
        ON CONFLICT (email_normalized) DO UPDATE SET
          email = EXCLUDED.email,
          name = COALESCE(customer_accounts.name, EXCLUDED.name),
          updated_at = NOW()
        RETURNING id, email, name, photo_url
      `;
      return { id: rows[0].id, email: rows[0].email, name: rows[0].name, photoUrl: rows[0].photo_url };
    } catch (error) {
      throw new AccountStoreUnavailableError("Falha ao preparar a conta do cliente.", error);
    }
  }

  async createSession(order: OrderRecord, tokenHash: string, expiresAt: string): Promise<CustomerSession> {
    try {
      return await this.sql.begin(async (transaction) => {
        const accountRows = await transaction<{ id: string; email: string; name: string | null; photo_url: string | null }[]>`
          INSERT INTO customer_accounts (id, email, email_normalized, name)
          VALUES (${randomUUID()}, ${order.payerEmail}, ${normalizedEmail(order.payerEmail)}, ${order.payerName?.trim() || null})
          ON CONFLICT (email_normalized) DO UPDATE SET
            email = EXCLUDED.email,
            name = COALESCE(customer_accounts.name, EXCLUDED.name),
            updated_at = NOW()
          RETURNING id, email, name, photo_url
        `;
        const sessionId = randomUUID();
        await transaction`
          INSERT INTO customer_sessions (id, account_id, token_hash, expires_at)
          VALUES (${sessionId}, ${accountRows[0].id}, ${tokenHash}, ${expiresAt})
        `;
        return {
          id: sessionId,
          profile: {
            id: accountRows[0].id,
            email: accountRows[0].email,
            name: accountRows[0].name,
            photoUrl: accountRows[0].photo_url,
          },
          expiresAt,
        };
      });
    } catch (error) {
      throw new AccountStoreUnavailableError("Falha ao criar a sessão do cliente.", error);
    }
  }

  async getSession(tokenHash: string): Promise<CustomerSession | null> {
    try {
      const rows = await this.sql<SessionRow[]>`
        SELECT sessions.id AS session_id, accounts.id AS account_id, accounts.email,
          accounts.name, accounts.photo_url, sessions.expires_at
        FROM customer_sessions sessions
        INNER JOIN customer_accounts accounts ON accounts.id = sessions.account_id
        WHERE sessions.token_hash = ${tokenHash}
          AND sessions.revoked_at IS NULL
          AND sessions.expires_at > NOW()
        LIMIT 1
      `;
      return rows[0] ? toSession(rows[0]) : null;
    } catch (error) {
      throw new AccountStoreUnavailableError("Falha ao validar a sessão do cliente.", error);
    }
  }

  async revokeSession(tokenHash: string): Promise<void> {
    try {
      await this.sql`
        UPDATE customer_sessions
        SET revoked_at = NOW()
        WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
      `;
    } catch (error) {
      throw new AccountStoreUnavailableError("Falha ao encerrar a sessão do cliente.", error);
    }
  }
}

const globalForAccountStore = globalThis as unknown as { __escalaHubAccountStore?: AccountStore };

export function getAccountStore(): AccountStore {
  if (globalForAccountStore.__escalaHubAccountStore) return globalForAccountStore.__escalaHubAccountStore;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) throw new AccountStoreUnavailableError("DATABASE_URL inválida.");
    globalForAccountStore.__escalaHubAccountStore = new PostgresAccountStore(databaseUrl);
  } else if (process.env.NODE_ENV === "production") {
    throw new AccountStoreUnavailableError("DATABASE_URL não configurada.");
  } else {
    globalForAccountStore.__escalaHubAccountStore = new InMemoryAccountStore();
  }
  return globalForAccountStore.__escalaHubAccountStore;
}
