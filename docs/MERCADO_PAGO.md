# Integração com o Mercado Pago

## Visão geral

O checkout da EscalaHub processa pagamentos reais via Mercado Pago (Pix e
cartão de crédito) através de uma camada de abstração em `lib/payments/`.
Nenhum componente ou rota da aplicação conversa diretamente com o SDK do
Mercado Pago — tudo passa pela interface `PaymentGateway`.

```
lib/payments/
  types.ts        Tipos de domínio (independentes de qualquer gateway)
  interfaces.ts    Contrato PaymentGateway + erros
  gateway.ts        Ponto único de acesso — getPaymentGateway()
  mercadoPago.ts    Único arquivo que importa o SDK do Mercado Pago
  utils.ts          CPF, e-mail, nome, status, idempotência
  orderStore.ts      Persistência de pedidos (ver "Limitações" abaixo)
```

Para adicionar Stripe, Asaas ou outro gateway no futuro: implemente
`PaymentGateway` em um novo arquivo dentro de `lib/payments/` e troque a
instância criada em `gateway.ts`. Nenhuma rota de API, nenhum componente de
checkout e nenhuma outra parte da aplicação precisa mudar.

## Fluxo de pagamento

1. O usuário preenche o checkout existente (`components/product/Checkout.tsx`)
   e escolhe Pix ou cartão. O layout e a UX não foram alterados — apenas a
   lógica de envio.
2. **Pix**: o formulário envia nome, e-mail e CPF para
   `POST /api/payments/create`. A rota busca o produto e o preço reais no
   catálogo (o valor nunca vem do cliente), cria a cobrança no Mercado Pago e
   devolve o QR Code (imagem base64) e o código copia-e-cola. A tela de
   confirmação exibe o QR Code e faz polling de status.
3. **Cartão**: o número, nome, validade e CVV nunca são enviados ao backend.
   O Mercado Pago.js (`https://sdk.mercadopago.com/js/v2`) tokeniza o cartão
   no navegador usando a chave pública (`NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`)
   e o backend recebe apenas o token de uso único, a bandeira detectada e o
   número de parcelas.
4. A rota `POST /api/payments/create` registra primeiro o pedido pendente e
   depois chama `gateway.createPayment(...)`. Isso elimina a janela em que um
   webhook poderia chegar antes da existência do pedido. O identificador de
   idempotência gerado no navegador é reutilizado em tentativas após falhas de
   rede e também é enviado ao Mercado Pago.
5. `POST /api/payments/webhook` recebe as notificações do Mercado Pago,
   valida a assinatura (`WebhookSignatureValidator` do SDK oficial) e, em
   caso de sucesso, **busca o pagamento novamente na API do Mercado Pago**
   antes de atualizar o status do pedido — o corpo da notificação nunca é
   usado como fonte de verdade.
6. `GET /api/payments/status?orderId=...` permite que o checkout consulte o
   status atualizado (usado no polling do Pix e de cartões em processamento).
7. Quando o status autoritativo chega a `approved`, o evento `Purchase` é
   disparado no navegador com a referência externa como `transactionId` e
   `eventID`, preparando deduplicação futura com eventos server-side.

## Segurança

- O Access Token e o segredo do webhook nunca chegam ao navegador — apenas
  variáveis de ambiente sem o prefixo `NEXT_PUBLIC_`.
- Dados de cartão (PAN, validade, CVV) trafegam apenas entre o navegador e o
  Mercado Pago; o backend da EscalaHub nunca os recebe, eliminando o alerta
  registrado em `docs/PRODUCTION_CHECKLIST.md` sobre uso de campos de
  cartão sem tokenização.
- Toda notificação de webhook tem a assinatura validada
  (`x-signature` / `x-request-id`) antes de qualquer efeito colateral.
- A assinatura precisa estar dentro de uma janela de cinco minutos; estados
  terminais não podem regredir em reenvios do mesmo evento.
- A confirmação de pagamento nunca é aceita a partir do que o navegador
  envia — o status final vem sempre de uma consulta servidor-a-servidor ao
  Mercado Pago.
- Referência externa, ID do pagamento, método, valor, moeda e e-mail são
  reconciliados com o pedido antes de qualquer atualização.
- O preço cobrado é sempre lido do catálogo (`lib/catalog`) no servidor,
  nunca do payload enviado pelo cliente.
- A criação usa uma chave de idempotência estável por tentativa de compra
  (`escalahub-<externalReference>`), preservada pelo cliente em falhas de rede,
  para impedir cobranças duplicadas em reenvios.

## Variáveis de ambiente

| Variável | Onde é usada | Observação |
| --- | --- | --- |
| `MERCADO_PAGO_ACCESS_TOKEN` | Servidor | Nunca expor ao cliente. |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Servidor | Usado para validar a assinatura do webhook. |
| `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` | Cliente | É a chave **pública** do Mercado Pago — segura para expor; usada apenas para tokenizar o cartão no navegador. |
| `NEXT_PUBLIC_SITE_URL` | Servidor e cliente | URL HTTPS canônica usada para construir o webhook e os metadados. |

> **Decisão técnica:** o prompt original sugeria também uma variável
> `NEXT_PUBLIC_APP_URL`. O projeto já possui `NEXT_PUBLIC_SITE_URL`
> (`lib/site.ts`) com exatamente esse propósito, então a URL de notificação
> do webhook (`notification_url`) reutiliza essa fonte única de verdade em
> vez de duplicar a mesma informação em duas variáveis.

## Limitações conhecidas e bloqueios de produção

- **P0 — persistência de pedidos**: `OrderStore` usa uma implementação em
  memória (`orderStore.ts`), suficiente para uma única instância Node.js de
  longa duração. Em uma implantação serverless com múltiplas instâncias, a
  interface `OrderStore` deve ganhar uma implementação sobre um banco de
  dados real — nenhuma rota de API precisa mudar quando isso acontecer.
- **P0 — liberação e entrega do produto**: o webhook já identifica com segurança
  quando um pagamento foi aprovado; falta conectar esse evento a um fluxo de
  liberação (e-mail transacional, geração de link de download protegido).
  Esse é o próximo item do roadmap (`PROJECT_STATUS.md`, prioridade P1).
- **P1 — proteção contra abuso**: o endpoint de criação ainda precisa de rate
  limiting distribuído e observabilidade antes de receber tráfego em escala.
- **P1 — Conversions API server-side do Meta**: o Pixel client-side já dispara
  `Purchase` na aprovação do pagamento. Uma camada de eventos server-side
  (Conversions API) pode ser adicionada futuramente no handler do webhook,
  reaproveitando os dados já normalizados em `WebhookNotification`.
- **Parcelamento**: o checkout atual processa o cartão em parcela única, compatível com o valor atual do produto (pagamento único, já indicado na UI).
