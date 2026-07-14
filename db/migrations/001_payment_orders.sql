BEGIN;

CREATE TABLE IF NOT EXISTS payment_orders (
  external_reference UUID PRIMARY KEY,
  product_slug TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL CHECK (currency = 'BRL'),
  payer_email TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'card')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'in_process', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back')),
  access_status TEXT NOT NULL DEFAULT 'pending' CHECK (access_status IN ('pending', 'granted', 'revoked')),
  gateway_payment_id TEXT,
  access_granted_at TIMESTAMPTZ,
  gateway_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_gateway_payment_id_unique
  ON payment_orders (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_orders_payer_email_index
  ON payment_orders (LOWER(payer_email));

CREATE INDEX IF NOT EXISTS payment_orders_status_updated_at_index
  ON payment_orders (payment_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_key CHAR(64) PRIMARY KEY,
  external_reference UUID NOT NULL REFERENCES payment_orders(external_reference) ON DELETE CASCADE,
  gateway_payment_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payment_webhook_events_payment_index
  ON payment_webhook_events (gateway_payment_id, received_at DESC);

COMMIT;
