# PROJECT STATUS

**Projeto:** EscalaHub

**Versão Atual:** v1.0

**Status:** Em desenvolvimento

**Última atualização:** 12/07/2026

---

# Objetivo

Construir uma plataforma própria de venda de infoprodutos, independente de marketplaces como Kiwify e Hotmart.

A plataforma deve ser escalável, segura e preparada para suportar centenas de produtos digitais.

---

# Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion

---

# Funcionalidades concluídas

- Estrutura inicial da aplicação
- Design System
- Header
- Hero
- Home
- Página de Produto
- Checkout próprio
- Catálogo de produtos
- SEO inicial
- Analytics (estrutura)
- Componentização
- Integração do Mercado Pago (Pix e cartão tokenizado)
- Webhook com validação de assinatura e reconsulta server-to-server
- Evento de conversão `Purchase` conectado à aprovação real do pagamento

---

# Funcionalidades em andamento

- Liberação automática do produto (e-mail transacional / download protegido)
- Persistência de pedidos em banco de dados real (hoje em memória, ver `docs/MERCADO_PAGO.md`)

---

# Próxima prioridade (P0)

- Persistir pedidos em banco transacional antes de executar em múltiplas instâncias.
- Conectar a aprovação do pagamento à entrega idempotente do produto.
- Proteger o dashboard antes de conectar dados reais.

Ver `docs/MERCADO_PAGO.md` e `docs/RC1_AUDIT.md` para o fluxo completo e os bloqueios de produção.

---

# Próximas prioridades (P1)

- Área do Cliente
- Download automático
- Histórico de pedidos
- Perfil do usuário

---

# Futuras melhorias (P2)

- Marketplace
- Cupons
- Programa de afiliados
- Dashboard administrativo
- Múltiplos autores
- Assinaturas

---

# Arquitetura

O projeto deve permanecer desacoplado.

Nunca acoplar componentes ao gateway de pagamento.

Toda comunicação deve acontecer através da camada:

lib/payments/

---

# Padrões

- Reutilizar componentes existentes.
- Não criar componentes duplicados.
- Não utilizar any.
- Não deixar código morto.
- Sempre executar lint, type-check e build antes de finalizar.

---

# Decisões técnicas

- Checkout próprio.
- Sem dependência da Kiwify.
- Gateway escolhido: Mercado Pago.
- Arquitetura preparada para adicionar Stripe futuramente (ver `docs/MERCADO_PAGO.md`).
- Produtos carregados a partir do catálogo.
- Componentes reutilizáveis.
- Pedidos persistidos via interface `OrderStore`, hoje em memória; trocar por banco de dados real antes de escalar para múltiplas instâncias.

---

# Bugs conhecidos

Nenhum erro crítico de compilação registrado. O build deixou de depender do Google Fonts e foi validado com sucesso em 13 de julho de 2026.

Os bloqueios operacionais da RC1 estão documentados em `docs/RC1_AUDIT.md` e impedem a aprovação para tráfego pago até serem resolvidos.

---

# Critério para considerar a versão 1.0 pronta

- Mercado Pago integrado.
- Webhooks funcionando.
- Checkout validado.
- Meta Pixel configurado.
- Google Analytics configurado.
- Build sem erros.
- TypeScript sem erros.
- ESLint sem erros.
- Deploy em produção.

---

# Observações

Toda alteração futura deve preservar a arquitetura existente.

A prioridade da EscalaHub é estabilidade, escalabilidade e facilidade de manutenção.
