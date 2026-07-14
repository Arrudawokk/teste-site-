# PROJECT STATUS

**Projeto:** EscalaHub

**Versão atual:** v1.0.0

**Status:** código V1 aprovado e publicado; lançamento comercial condicionado ao checklist operacional

**Última atualização:** 14/07/2026

## Objetivo

Construir uma plataforma própria, segura e escalável de venda de produtos digitais, independente de marketplaces e preparada para suportar centenas de produtos.

## Stack

- Next.js 16 com App Router
- React 19 e TypeScript
- Tailwind CSS e Framer Motion
- Mercado Pago
- PostgreSQL

## Funcionalidades concluídas

- Home, página de produto, checkout, blog e páginas institucionais.
- Catálogo tipado e reutilizável de produtos.
- Design System e interface responsiva.
- SEO técnico com metadata, canonical, Open Graph, Twitter Cards, sitemap, robots e JSON-LD.
- Analytics preparado para GA4, GTM e Meta Pixel.
- Checkout próprio com Pix e cartão tokenizado pelo Mercado Pago.js.
- Criação de pagamento idempotente, preço validado pelo catálogo e reconciliação server-to-server.
- Persistência transacional de pedidos em PostgreSQL por meio da abstração `OrderStore`.
- Webhook com assinatura, janela antirreplay, deduplicação persistente e transições de estado protegidas.
- Atualização, liberação e revogação de acesso na mesma transação do pedido.
- Reconciliação ativa pelo endpoint de status quando o webhook atrasa.
- Download protegido por HMAC, expiração curta, validação do pedido e proxy de origem privada.
- Retomada do pedido no navegador sem persistir e-mail, CPF ou dados de cartão.
- Evento `Purchase` ligado somente a pedido aprovado, com identificador estável para deduplicação.
- Camada centralizada de analytics para GA4, Meta Pixel e Google Tag Manager.
- Eventos `page_view`, `view_item`, `begin_checkout` e `purchase` padronizados no Data Layer.
- Meta Pixel com `currency`, `value`, `content_ids`, `content_type` e `eventID` em todos os eventos relevantes.
- UTMs, `gclid` e `fbclid` preservados durante a sessão e associados aos eventos até a confirmação da compra.
- Fila segura para eventos do Meta Pixel disparados antes do carregamento do script.
- Eventos `Search` e `Lead` preparados sem gerar conversões artificiais em fluxos que ainda não os confirmam.
- Área do cliente autenticada com sessão opaca, cookie HttpOnly e validação server-side.
- Biblioteca automática baseada nas compras aprovadas do catálogo, sem conteúdo hardcoded.
- Histórico de pedidos com produto, valor, status, data, gateway e forma de pagamento.
- Perfil preparado para nome, e-mail, foto e configurações futuras.
- Download autenticado que revalida sessão, titularidade, pagamento e acesso antes de buscar o arquivo privado.
- Abstração de arquivos privados preparada para adaptadores de Vercel Blob, S3 ou Cloudflare R2.
- Camada de e-mails transacionais desacoplada do provedor com templates de aprovação, pendência, reembolso e entrega.
- Estados vazios, loading, erro e recuperação de acesso pelo código do pedido aprovado.

## Ativação operacional obrigatória

Antes de aceitar vendas reais no domínio final:

1. Provisionar PostgreSQL com pooler e executar, em ordem, `db/migrations/001_payment_orders.sql` e `db/migrations/002_customer_accounts.sql`.
2. Configurar `DATABASE_URL` e todas as credenciais reais do Mercado Pago.
3. Armazenar o produto em origem privada e configurar as variáveis de entrega descritas em `.env.example`.
4. Gerar `DELIVERY_TOKEN_SECRET` com no mínimo 32 caracteres aleatórios.
5. Homologar Pix, cartão aprovado/recusado, webhook, reenvio, reembolso, chargeback e download no ambiente de teste do Mercado Pago.
6. Configurar consentimento e revisar juridicamente a ativação de tags de marketing.
7. Escolher uma única rota de envio ao GA4: integração direta ou tags do GTM, nunca ambas para a mesma propriedade.
8. Validar todos os eventos no Meta Test Events, GA4 DebugView e modo Preview do GTM no domínio definitivo.
9. Homologar criação, retomada e encerramento de sessão, biblioteca e download autenticado em produção.

## Produção

- Branch oficial: `main`, com toda a sequência RC1–RC5.
- URL operacional validada: `https://teste-site-qnxk.vercel.app`.
- Home, produto, checkout, blog e conta respondem HTTP 200.
- A URL canônica e o callback do Mercado Pago utilizam `NEXT_PUBLIC_SITE_URL` quando configurada e, na Vercel, recorrem automaticamente a `VERCEL_PROJECT_PRODUCTION_URL`.
- O repositório possui dois projetos Vercel conectados. `teste-site-qnxk` é o projeto operacional; `teste-site` deve ser revisado e removido somente depois de confirmar domínios e variáveis no painel.
- O endereço `teste-site.vercel.app` não está atribuído ao deploy operacional e não deve ser divulgado.

## Prioridades P0 restantes da aplicação

- Executar a homologação operacional acima no domínio definitivo.
- Preencher e validar as variáveis públicas do Mercado Pago e de analytics na Vercel; a auditoria externa da RC5 não encontrou os respectivos scripts ativos no HTML publicado antes do deploy.
- Apontar o domínio final para este projeto antes de iniciar campanhas. `escalahub.com` ainda publica outra aplicação.
- Validar backup, restauração e alertas do banco de produção.
- Consolidar os dois projetos Vercel em um único projeto, preservando variáveis e domínios do projeto operacional.

## Qualidade da V1

- Pacote marcado como `1.0.0` em `package.json` e no lockfile.
- Sitemap deixou de atribuir uma data de alteração artificial a páginas estáticas em todo deploy; datas reais dos artigos foram preservadas.
- Template raiz sem comportamento removido para evitar remontagens desnecessárias entre rotas.
- `npm install`: 367 pacotes auditados e nenhuma vulnerabilidade reportada.
- `npm run lint`, `npm run type-check` e `npm run build`: aprovados com Next.js 16.2.10 e 33 rotas.
- Home, produto, checkout, conteúdo, institucionais, conta, robots, sitemap e manifest: HTTP 200 no deploy operacional.
- Rota inexistente: HTTP 404 com fallback próprio.
- Rejeições seguras confirmadas: origem inválida do checkout (403), payload inválido (400), status inválido (400), webhook sem assinatura (401) e download inválido (400).
- Headers de segurança e cache privado das páginas sensíveis confirmados no ambiente publicado.
- O HTML público ainda não carrega Mercado Pago.js, GA4, GTM ou Meta Pixel; as variáveis públicas correspondentes precisam ser ativadas antes de tráfego pago.
- O deploy V1 do commit `179cfd1` concluiu com sucesso no projeto `teste-site-qnxk`; o alias operacional foi revalidado após a publicação.
- O projeto Vercel duplicado `teste-site` também concluiu um deploy da V1 após atraso no registro; sua configuração deve ser revisada antes de remoção para evitar publicações duplicadas.
- Relatório, limitações, changelog, notas e checklist final estão em `docs/V1_RELEASE.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/CHANGELOG.md` e `RELEASE_NOTES.md`.

## Prioridades P1

- Rate limiting distribuído/WAF nos endpoints de pagamento.
- Monitoramento e alertas para falhas de webhook, banco, gateway e entrega.
- Conectar um provedor real à camada de e-mails transacionais e processar envios com fila persistente.
- Adicionar rate limiting ao formulário de recuperação da conta.
- Meta Conversions API e Google Enhanced Conversions server-side.
- Testes E2E automatizados no ambiente sandbox do Mercado Pago.

## Decisões técnicas

- A aplicação continua desacoplada do Mercado Pago por `PaymentGateway`.
- O armazenamento continua desacoplado por `OrderStore`.
- Em desenvolvimento sem `DATABASE_URL`, existe fallback em memória; em produção, a aplicação falha de forma segura e recusa o checkout sem banco.
- O arquivo digital nunca fica em `public/`; a rota de entrega valida o acesso antes de buscar a origem privada.
- Dados de cartão nunca passam pelo servidor da EscalaHub.
- Nenhum segredo utiliza prefixo `NEXT_PUBLIC_`.

## Qualidade da RC2

- `npm install`: aprovado, sem vulnerabilidades reportadas.
- `npm run lint`: aprovado.
- `npm run type-check`: aprovado.
- `npm run build`: aprovado.
- Rotas negativas de status, download, webhook e origem do checkout: validadas.
- Checkout revisado em mobile e desktop sem overflow de conteúdo.

## Qualidade da RC3

- Eventos iniciais e de navegação centralizados, sem disparo automático duplicado dos scripts de terceiros.
- `Purchase` permanece bloqueado para pedidos pendentes, recusados, cancelados, reembolsados ou contestados.
- Data Layer disponível mesmo quando o GTM ainda não terminou de carregar.
- Falhas de scripts e integrações são isoladas e registradas como `analytics_error`, sem interromper a aplicação.
- SEO técnico, imagens, fontes, hidratação e fronteiras entre Server e Client Components revisados sem regressões.
- `npm install`, `npm run lint`, `npm run type-check` e `npm run build`: aprovados na RC3.

## Qualidade da RC4

- Dashboard demonstrativo público removido do fluxo e redirecionado para a área autenticada.
- Dados da conta são carregados apenas no servidor e filtrados pela identidade da sessão.
- Acesso e download são revogados automaticamente quando o pedido deixa de estar aprovado.
- Migração aditiva preserva os pedidos existentes e adiciona contas e sessões sem alterar o fluxo do gateway.
- Validação final registrada em `docs/RC4_REPORT.md`.

## Qualidade da RC5

- Landing Page revisada para clareza de oferta, confiança e copy responsável, sem avaliações ou urgência artificiais.
- FAQ da Home passou a consumir o catálogo, eliminando duplicação de conteúdo.
- Hidratação global reduzida com a remoção do Framer Motion do template raiz e do menu do Header; microinteração mobile preservada em CSS.
- Checkout agora diferencia SDK de cartão carregando, pronto, indisponível ou com falha e mantém Pix disponível como alternativa.
- Validação de cartão e dados do comprador reforçada antes da tokenização, sem enviar PAN ou CVV ao servidor.
- Canonical, Open Graph, robots, sitemap e callback do webhook validados com a URL operacional da Vercel.
- `npm install`, `npm run lint`, `npm run type-check` e `npm run build`: aprovados; 33 rotas geradas e nenhuma vulnerabilidade reportada pelo npm.
- Detalhes e pendências operacionais registrados em `docs/RC5_REPORT.md`.

Consulte `docs/RC5_REPORT.md`, `RELEASE_NOTES.md`, `docs/ACCOUNT.md`, `docs/RC4_REPORT.md`, `docs/RC3_ANALYTICS.md`, `docs/RC3_REPORT.md`, `docs/RC2_REPORT.md` e `docs/MERCADO_PAGO.md` para a configuração, os fluxos completos e os riscos operacionais restantes.
