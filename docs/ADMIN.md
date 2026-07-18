# Painel administrativo

## Visão geral

O painel em `/admin` é uma superfície operacional separada da área do cliente. Ele consulta a mesma fonte transacional de pedidos, sem acessar a Stripe diretamente nas telas e sem alterar o checkout.

## Ativação

1. Execute `db/migrations/004_admin_operations.sql` no PostgreSQL depois das migrações 001–003.
2. Execute `npm run admin:hash-password` em um terminal confiável.
3. Configure `ADMIN_EMAIL` e o valor completo de `ADMIN_PASSWORD_HASH` na Vercel.
4. Faça um novo deploy e acesse `/admin/entrar`.

A senha nunca é persistida. O hash usa bcrypt com salt aleatório e custo mínimo 12. A sessão administrativa é opaca, armazenada no PostgreSQL e enviada em cookie HttpOnly, Secure, SameSite Strict, com duração de oito horas.

## Segurança

- O `proxy.ts` faz a barreira otimista em `/admin` e `/api/admin`.
- Toda página, consulta e mutação repete a autorização no servidor.
- Cinco falhas em quinze minutos bloqueiam temporariamente o fingerprint de acesso.
- Reprocessar um pedido apenas consulta a Checkout Session existente, reconcilia o status, prepara a conta e libera o acesso quando a Stripe confirma aprovação. Nenhuma cobrança ou sessão é criada.
- Exportações e ações administrativas entram na trilha de auditoria.
- Payloads de webhooks são resumidos por allowlist. Cartões, tokens, assinaturas, chaves e corpo bruto não são armazenados.

## Operação

- `/admin`: métricas e atividade recente.
- `/admin/pedidos`: filtros, paginação, busca e exportação CSV/Excel.
- `/admin/pedidos/[id]`: comprador, pagamento, entrega, webhooks e timeline.
- `/admin/clientes`: clientes, compras, login e downloads.
- `/admin/webhooks`: eventos Stripe e JSON sanitizado.
- `/admin/logs`: auditoria estruturada.
- `/admin/estatisticas`: séries de vendas, receita, conversão, abandono e downloads.

## Retenção

As tabelas `operational_audit_events`, `payment_webhook_events` e `product_download_events` são append-only pela aplicação. Não existem ações administrativas para apagar pedidos, logs, webhooks ou downloads.
