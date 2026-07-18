# PROJECT STATUS

**Projeto:** EscalaHub

**Versão atual:** v1.0.0

**Status:** código V1 aprovado e publicado; lançamento comercial condicionado ao checklist operacional

**Última atualização:** 18/07/2026

## Objetivo

Construir uma plataforma própria, segura e escalável de venda de produtos digitais, independente de marketplaces e preparada para suportar centenas de produtos.

## Stack

- Next.js 16 com App Router
- React 19 e TypeScript
- Tailwind CSS e Framer Motion
- Stripe Checkout
- PostgreSQL
- Cloudflare R2 privado

## Funcionalidades concluídas

- Home, página de produto, checkout, blog e páginas institucionais.
- Catálogo tipado e reutilizável de produtos.
- Design System e interface responsiva.
- SEO técnico com metadata, canonical, Open Graph, Twitter Cards, sitemap, robots e JSON-LD.
- Analytics preparado para GA4, GTM e Meta Pixel.
- Pré-checkout próprio com pagamento por cartão na página hospedada da Stripe; Pix permanece condicionado à ativação na conta.
- Criação de pagamento idempotente, preço validado pelo catálogo e reconciliação server-to-server.
- Persistência transacional de pedidos em PostgreSQL por meio da abstração `OrderStore`.
- Webhook com assinatura, janela antirreplay, deduplicação persistente e transições de estado protegidas.
- Atualização, liberação e revogação de acesso na mesma transação do pedido.
- Reconciliação ativa pelo endpoint de status quando o webhook atrasa.
- Download protegido por HMAC, expiração curta, validação do pedido e proxy de origem privada.
- Recuperação de checkout pendente com reutilização da Checkout Session aberta, cancelamento seguro, renovação idempotente e polling de 10 segundos.
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
- Download autenticado que revalida sessão, titularidade, pagamento e acesso antes de emitir uma URL temporária.
- Provider Cloudflare R2 desacoplado por `PrivateAssetStore`, com `HeadObject`, `GetObject` assinado por cinco minutos e resposta 404 para objeto ausente.
- Camada de e-mails transacionais desacoplada do provedor com templates de aprovação, pendência, reembolso e entrega.
- Estados vazios, loading, erro e recuperação de acesso pelo código do pedido aprovado.

## Ativação operacional obrigatória

Antes de aceitar vendas reais no domínio final:

1. Provisionar PostgreSQL com pooler e executar, em ordem, as migrações `001`, `002` e `003` em `db/migrations/`.
2. Rotacionar a Secret Key compartilhada durante a migração e configurar as quatro variáveis reais da Stripe.
3. Criar o bucket R2 privado, enviar o produto na chave do catálogo e configurar as quatro credenciais descritas em `.env.example`.
4. Gerar `DELIVERY_TOKEN_SECRET` com no mínimo 32 caracteres aleatórios.
5. Homologar Pix, cartão aprovado/recusado, webhook, reenvio, reembolso, disputa e download no modo de teste da Stripe.
6. Configurar consentimento e revisar juridicamente a ativação de tags de marketing.
7. Escolher uma única rota de envio ao GA4: integração direta ou tags do GTM, nunca ambas para a mesma propriedade.
8. Validar todos os eventos no Meta Test Events, GA4 DebugView e modo Preview do GTM no domínio definitivo.
9. Homologar criação, retomada e encerramento de sessão, biblioteca e download autenticado em produção.

## Produção

- Branch oficial: `main`, com toda a sequência RC1–RC8.
- URL operacional validada para o checkout Stripe: `https://escala-hub-six.vercel.app`.
- Home, produto, checkout, blog e conta respondem HTTP 200.
- A URL canônica e os retornos da Stripe utilizam `NEXT_PUBLIC_SITE_URL` quando configurada e, na Vercel, recorrem automaticamente a `VERCEL_PROJECT_PRODUCTION_URL`.
- O repositório possui três projetos Vercel conectados. `escala-hub` é o único validado com a configuração completa do checkout Stripe; `teste-site-qnxk` retorna 503 no checkout e `teste-site` permanece sem alias operacional.
- O endereço `teste-site.vercel.app` não está atribuído ao deploy operacional e não deve ser divulgado.

## Prioridades P0 restantes da aplicação

- Executar a homologação operacional acima no domínio definitivo.
- Consolidar Stripe, banco, R2 e analytics no projeto Vercel operacional antes de remover os projetos duplicados.
- Apontar o domínio final para este projeto antes de iniciar campanhas. `escalahub.com` ainda publica outra aplicação.
- Validar backup, restauração e alertas do banco de produção.
- Consolidar os dois projetos Vercel em um único projeto, preservando variáveis e domínios do projeto operacional.

## Qualidade da V1

- Pacote marcado como `1.0.0` em `package.json` e no lockfile.
- Sitemap deixou de atribuir uma data de alteração artificial a páginas estáticas em todo deploy; datas reais dos artigos foram preservadas.
- Template raiz sem comportamento removido para evitar remontagens desnecessárias entre rotas.
- `npm install`: 393 pacotes auditados e nenhuma vulnerabilidade reportada.
- `npm run lint`, `npm run type-check` e `npm run build`: aprovados com Next.js 16.2.10 e 33 rotas.
- Home, produto, checkout, conteúdo, institucionais, conta, robots, sitemap e manifest: HTTP 200 no deploy operacional.
- Rota inexistente: HTTP 404 com fallback próprio.
- Rejeições seguras confirmadas: origem inválida do checkout (403), payload inválido (400), status inválido (400), webhook sem assinatura (401) e download inválido (400).
- Headers de segurança e cache privado das páginas sensíveis confirmados no ambiente publicado.
- O checkout Stripe e as tags de analytics precisam ser homologados no novo deploy antes de tráfego pago.
- O deploy V1 do commit `179cfd1` concluiu com sucesso no projeto `teste-site-qnxk`; o alias operacional foi revalidado após a publicação.
- O projeto Vercel duplicado `teste-site` também concluiu um deploy da V1 após atraso no registro; sua configuração deve ser revisada antes de remoção para evitar publicações duplicadas.
- Relatório, limitações, changelog, notas e checklist final estão em `docs/V1_RELEASE.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/CHANGELOG.md` e `RELEASE_NOTES.md`.

## Prioridades P1

- Rate limiting distribuído/WAF nos endpoints de pagamento.
- Monitoramento e alertas para falhas de webhook, banco, gateway e entrega.
- Conectar um provedor real à camada de e-mails transacionais e processar envios com fila persistente.
- Adicionar rate limiting ao formulário de recuperação da conta.
- Meta Conversions API e Google Enhanced Conversions server-side.
- Testes E2E automatizados no modo de teste da Stripe.

## Decisões técnicas

- A aplicação continua desacoplada da Stripe por `PaymentGateway`; pedidos históricos preservam o gateway original.
- O armazenamento continua desacoplado por `OrderStore`.
- Arquivos privados continuam desacoplados por `PrivateAssetStore`; apenas o provider conhece a API S3 do R2.
- Em desenvolvimento sem `DATABASE_URL`, existe fallback em memória; em produção, a aplicação falha de forma segura e recusa o checkout sem banco.
- O arquivo digital nunca fica em `public/`; a rota de entrega valida o acesso antes de buscar a origem privada.
- Dados de cartão nunca passam pelo servidor da EscalaHub.
- Nenhum segredo utiliza prefixo `NEXT_PUBLIC_`; apenas a Publishable Key da Stripe é pública.

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

## Qualidade da RC6

- O erro Stripe deixou de ser ocultado: o bloco de diagnóstico registra o erro da SDK e seus campos tipados no servidor.
- Primeiro erro confirmado: `StripeInvalidRequestError`, HTTP 400, porque `pix` não está ativado na conta.
- Segundo erro confirmado: nenhum método dinâmico elegível estava ativo para a sessão.
- Correção final: Checkout Session restrita ao método `card`, comprovadamente aceito pela conta atual.
- Validação externa concluída em `https://escala-hub-six.vercel.app/api/payments/create`: HTTP 201, pedido pendente persistido e URL hospedada da Stripe retornada.
- `npm run lint`, `npm run type-check` e `npm run build`: aprovados com Next.js 16.2.10 e 33 rotas.
- Diagnóstico completo registrado em `docs/RC6_STRIPE_DIAGNOSIS.md`.

## Qualidade da RC7

- Pedidos pendentes recuperam a Checkout Session autoritativamente com `checkout.sessions.retrieve()`.
- Sessões abertas são reutilizadas; o backend não cria outro pedido, PaymentIntent ou cobrança.
- O retorno pelo cancelamento da Stripe mantém o pedido recuperável em vez de apagar o estado local.
- Cancelamento solicitado pelo cliente expira primeiro a sessão aberta na Stripe e preserva o histórico como `cancelled`.
- Pedidos expirados ou cancelados podem gerar uma nova sessão com nova chave idempotente, somente depois da confirmação de que a anterior não está aberta.
- A interface consulta o status a cada 10 segundos e redireciona pagamentos aprovados para `/account`.
- Detalhes operacionais registrados em `docs/RC7_CHECKOUT_RECOVERY.md`.

## Qualidade da RC8

- Painel administrativo protegido com sessão opaca persistida, bloqueio de tentativas e autorização server-side em cada consulta e ação.
- Dashboard operacional, pedidos paginados, clientes, eventos Stripe, logs estruturados, estatísticas responsivas e busca global.
- Exportação segura em CSV e Excel, com proteção contra fórmulas injetadas em células.
- Reprocessamento autoritativo de pedido sem nova cobrança, com reconciliação, preparação da conta e liberação condicionada à aprovação confirmada.
- Trilha append-only para auditoria, downloads e payloads sanitizados de webhooks.
- Migração aditiva `004_admin_operations.sql` e ativação documentada em `docs/ADMIN.md`.

Consulte `docs/STRIPE.md`, `docs/STORAGE.md`, `docs/R2.md`, `RELEASE_NOTES.md`, `docs/ACCOUNT.md` e `docs/RC3_ANALYTICS.md` para configuração, fluxos e riscos operacionais atuais. Os relatórios RC anteriores permanecem como histórico do estado auditado na época.
