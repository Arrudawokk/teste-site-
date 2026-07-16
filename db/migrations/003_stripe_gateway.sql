BEGIN;

ALTER TABLE payment_orders
  ALTER COLUMN payment_gateway SET DEFAULT 'stripe';

ALTER TABLE payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_payment_gateway_check;

ALTER TABLE payment_orders
  ADD CONSTRAINT payment_orders_payment_gateway_check
  CHECK (payment_gateway IN ('mercado_pago', 'stripe'));

ALTER TABLE payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_payment_method_check;

ALTER TABLE payment_orders
  ADD CONSTRAINT payment_orders_payment_method_check
  CHECK (payment_method IN ('pix', 'card', 'stripe_checkout'));

COMMIT;
