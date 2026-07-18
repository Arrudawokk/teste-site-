BEGIN;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  admin_email_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_sessions_active_idx
  ON admin_sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  fingerprint_hash CHAR(64) NOT NULL,
  succeeded BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_login_attempts_recent_idx
  ON admin_login_attempts (fingerprint_hash, attempted_at DESC);

CREATE TABLE IF NOT EXISTS operational_audit_events (
  id BIGSERIAL PRIMARY KEY,
  level VARCHAR(8) NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  event TEXT NOT NULL,
  actor_type VARCHAR(16) NOT NULL CHECK (actor_type IN ('system', 'admin', 'customer', 'gateway')),
  actor_id_hash CHAR(64),
  entity_type VARCHAR(32) NOT NULL,
  entity_id TEXT,
  order_id UUID REFERENCES payment_orders(external_reference) ON DELETE RESTRICT,
  gateway_payment_id TEXT,
  status TEXT,
  request_id TEXT NOT NULL,
  source TEXT NOT NULL,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS operational_audit_events_created_idx
  ON operational_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS operational_audit_events_order_idx
  ON operational_audit_events (order_id, created_at ASC)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operational_audit_events_event_idx
  ON operational_audit_events (event, created_at DESC);

CREATE TABLE IF NOT EXISTS product_download_events (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES payment_orders(external_reference) ON DELETE RESTRICT,
  account_id UUID REFERENCES customer_accounts(id) ON DELETE SET NULL,
  request_id TEXT NOT NULL,
  source VARCHAR(24) NOT NULL,
  result VARCHAR(16) NOT NULL CHECK (result IN ('authorized', 'forbidden', 'not_found', 'unavailable', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_download_events_order_idx
  ON product_download_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_download_events_created_idx
  ON product_download_events (created_at DESC);

ALTER TABLE payment_webhook_events
  ADD COLUMN IF NOT EXISTS gateway_event_id TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS result TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS payload_summary JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS payment_webhook_events_received_idx
  ON payment_webhook_events (received_at DESC);

COMMIT;
