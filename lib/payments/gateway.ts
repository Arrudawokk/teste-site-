import { StripeGateway } from "./stripe";
import type { PaymentGateway } from "./interfaces";

/**
 * Ponto único de acesso à camada de pagamentos.
 *
 * Toda a aplicação (rotas de API, checkout) deve obter o gateway através
 * desta função. Para adicionar um novo gateway (Stripe, Asaas...) no
 * futuro, basta implementar `PaymentGateway` em um novo arquivo e trocar a
 * instância criada aqui — nenhuma outra parte do projeto precisa mudar.
 */
let cachedGateway: PaymentGateway | null = null;

export function getPaymentGateway(): PaymentGateway {
  if (!cachedGateway) {
    cachedGateway = new StripeGateway();
  }
  return cachedGateway;
}

export type { PaymentGateway } from "./interfaces";
