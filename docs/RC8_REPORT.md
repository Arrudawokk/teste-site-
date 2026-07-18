# RC8 — Painel Administrativo, Observabilidade e Operação

## Escopo entregue

A RC8 adiciona uma superfície operacional protegida sem modificar o checkout, a criação de Checkout Sessions, a validação dos webhooks Stripe, o armazenamento Cloudflare R2 ou as regras de liberação dos produtos.

## Funcionalidades implementadas

- Dashboard com vendas, receita total e diária, pedidos por status, reembolsos, chargebacks, conversão, checkouts iniciados e abandonados, clientes e downloads.
- Pedidos com busca global, filtros combináveis, paginação, exportação CSV/Excel e página detalhada.
- Página do pedido com comprador, produto, valores, gateway, sessão Stripe, conta, entrega, webhooks e timeline permanente.
- Clientes com pesquisa, status, produtos, última autenticação e downloads.
- Eventos Stripe com resultado, duração, payload sanitizado e visualização em JSON.
- Logs operacionais estruturados e filtráveis.
- Gráficos responsivos de vendas, receita, conversão, abandono, clientes e downloads.
- Reprocessamento autoritativo de pedidos sem gerar cobrança ou Checkout Session nova.
- Auditoria de ações administrativas, webhooks e downloads.
- Sessão administrativa opaca, rate limit de login e autorização no servidor.

## Arquitetura e segurança

- `lib/admin/store.ts` mantém o acesso aos dados atrás de um contrato único, com PostgreSQL em produção e memória apenas no desenvolvimento local.
- `proxy.ts` aplica uma verificação otimista; páginas, Server Actions e APIs repetem a validação completa da sessão.
- A senha administrativa nunca é armazenada. A autenticação usa PBKDF2-SHA256 com salt aleatório e 210.000 iterações.
- Cookies administrativos são HttpOnly, Secure, SameSite Strict e expiram em oito horas.
- CSV e Excel neutralizam conteúdo que poderia ser interpretado como fórmula.
- Payloads persistidos usam allowlist e não guardam cartões, tokens, assinaturas ou corpos brutos.
- A migração é aditiva e não remove dados. Pedidos, webhooks, logs e downloads não possuem ação de exclusão.

## Arquivos principais

- `app/admin/` e `components/admin/`: interface, estados e ações do painel.
- `app/api/admin/`: exportação e reprocessamento protegido.
- `lib/admin/`: autenticação, persistência, métricas, observabilidade e reconciliação.
- `db/migrations/004_admin_operations.sql`: sessões, tentativas de acesso, auditoria e downloads.
- `proxy.ts`: proteção otimista das rotas administrativas.
- `scripts/generate-admin-password-hash.mjs`: geração local do hash da senha.
- `docs/ADMIN.md`: ativação e operação.

## Validações executadas

- Login válido e redirecionamento para `/admin`: aprovado em ambiente local.
- Proteção de página e APIs sem sessão: aprovada.
- Dashboard e gráficos: aprovados.
- Pedidos, clientes, webhooks, logs e estatísticas: aprovados.
- Busca, filtros e paginação: aprovados estruturalmente e por navegação.
- Exportação CSV e Excel: downloads aprovados.
- Responsividade mobile: rotas principais sem overflow horizontal a 390 px.
- Capturas: `docs/screenshots/rc8-admin-dashboard-desktop-viewport.png` e `docs/screenshots/rc8-admin-dashboard-mobile-viewport.png`.
- ESLint, TypeScript e build de produção: aprovados na validação final da RC8.

O reprocessamento real não foi acionado contra um pedido pago em produção para preservar a operação. O caminho foi validado por análise do fluxo e compilação: ele recupera a sessão Stripe existente, reconcilia o pedido e só libera o produto após confirmação autoritativa de pagamento.

## Ativação em produção

1. Aplicar `db/migrations/004_admin_operations.sql` depois das migrações 001–003.
2. Executar `npm run admin:hash-password` em terminal confiável.
3. Configurar `ADMIN_EMAIL` e `ADMIN_PASSWORD_HASH` na Vercel.
4. Fazer novo deploy e acessar `/admin/entrar`.

Sem essas três configurações, o restante da aplicação continua operando normalmente, mas o login administrativo permanece indisponível por segurança.
