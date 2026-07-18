# EscalaHub Architecture

## Projeto

EscalaHub é uma plataforma própria de venda de infoprodutos desenvolvida em Next.js.

O objetivo é possuir uma plataforma escalável, independente de marketplaces como Kiwify ou Hotmart.

O projeto deve permitir adicionar novos produtos sem alterar sua arquitetura.

---

# Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion

---

# Estrutura

app/

Rotas da aplicação.

components/

Componentes reutilizáveis da interface.

lib/

Lógica compartilhada.

public/

Imagens e arquivos estáticos.

---

# Princípios

Nunca recriar componentes existentes.

Sempre reutilizar componentes.

Nunca alterar a arquitetura sem necessidade.

Sempre manter o Design System.

Evitar código duplicado.

Utilizar TypeScript fortemente tipado.

---

# Produtos

Todos os produtos devem utilizar o catálogo existente.

Nunca criar produtos hardcoded.

A Home e a Página do Produto devem consumir os dados do catálogo.

---

# Checkout

O checkout pertence à EscalaHub.

Não utilizar checkout hospedado por terceiros.

A interface do checkout nunca deve depender diretamente do gateway de pagamento.

---

# Gateway

O projeto utiliza uma camada de abstração.

lib/payments/

gateway.ts

stripe.ts

types.ts

interfaces.ts

utils.ts

orderStore.ts

O restante da aplicação nunca conversa diretamente com a Stripe — apenas com `getPaymentGateway()` em `gateway.ts`.

O adaptador cria Stripe Checkout Sessions, valida preço e moeda e transforma eventos assinados no vocabulário interno. Pedidos históricos preservam o identificador do gateway anterior. Ver `docs/STRIPE.md` para configuração, segurança e homologação.

---

# Armazenamento privado

`lib/storage/privateAssets.ts` mantém o contrato `PrivateAssetStore` e implementa o provider Cloudflare R2 compatível com S3.

Produtos guardam somente a chave privada do objeto no catálogo. As rotas validam sessão ou token, pedido aprovado e acesso concedido antes de gerar uma URL `GetObject` assinada por cinco minutos. O bucket não é público e credenciais nunca chegam ao navegador.

---

# Eventos

Toda compra deve permitir integração com:

Meta Pixel

Google Analytics 4

Google Tag Manager

---

# Operações administrativas

`lib/admin/` concentra autenticação, consultas operacionais, auditoria, observabilidade e reconciliação. A interface em `/admin` consome exclusivamente essa camada e nunca acessa Stripe, armazenamento ou SQL diretamente.

As sessões administrativas são opacas e persistidas no PostgreSQL. O `proxy.ts` aplica a barreira otimista, enquanto layouts, Server Actions e Route Handlers repetem a autorização no servidor. Eventos operacionais, webhooks e downloads formam uma trilha append-only; não existem rotas para apagar histórico.

A migração `db/migrations/004_admin_operations.sql` e as variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD_HASH` ativam o painel. O procedimento está documentado em `docs/ADMIN.md`.

---

# Objetivo

Construir uma plataforma escalável capaz de vender centenas de produtos digitais utilizando a mesma arquitetura.

Toda modificação deve preservar:

- organização
- escalabilidade
- legibilidade
- reutilização
- segurança

Nunca fazer alterações que comprometam esses princípios.
