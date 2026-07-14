# EscalaHub v1.0 — Checklist de produção

Data da auditoria: 12 de julho de 2026.

## Resultado executivo

**Status: não aprovada para receber tráfego pago.**

A camada front-end está estável, responsiva e compilando sem erros. A liberação comercial permanece bloqueada por dependências operacionais fora do escopo autorizado desta sprint: domínio apontando para outra aplicação, checkout sem provedor de pagamento real, ausência de confirmação server-side de compra, dashboard sem autenticação e ausência de páginas legais.

## O que foi revisado

- [x] Home, produto, checkout, dashboard e 404.
- [x] Layouts, componentes, bibliotecas, analytics e assets.
- [x] Links de menu, rodapé, CTAs, produto, checkout e 404.
- [x] Resoluções 1920, 1600, 1440, 1366, 1280, 1024, 768, 540, 430, 390, 375 e 360 px.
- [x] Titles, descriptions, canonicals, Open Graph e Twitter Cards.
- [x] Robots, sitemap, favicon, Apple icon e Web Manifest.
- [x] JSON-LD de WebSite, Organization e Product.
- [x] Next/Image, fontes, preload, lazy loading e prevenção de CLS.
- [x] Headings, landmarks, labels, `alt`, foco, targets e contraste.
- [x] CSP, HSTS, anti-framing, referrer policy e permissions policy.
- [x] Arquivos de ambiente, segredos versionados e links externos.
- [x] Estrutura de GA4, GTM, Meta Pixel e eventos de marketing.
- [x] Dependências, código morto, TODOs, FIXMEs e logs esquecidos.
- [x] Instalação, auditoria npm, ESLint, TypeScript e build de produção.

## Problemas encontrados e corrigidos

- [x] Vulnerabilidade moderada no PostCSS interno do Next.js corrigida por override compatível para `8.5.18`.
- [x] Dependências sem uso (`react-hook-form` e `zod`) removidas.
- [x] Script oficial `type-check` adicionado.
- [x] Web Manifest ausente criado e vinculado aos metadados.
- [x] Apple icon inválido em SVG substituído por imagem PNG gerada pelo App Router.
- [x] Imagem social vertical do produto substituída por imagem 1200 × 630.
- [x] Imagens LCP da Home e do produto migradas para `preload` do Next.js 16.
- [x] Overflow horizontal do dashboard em 360 px corrigido.
- [x] Token de texto muted elevado para contraste AA em fundos escuros.
- [x] Alegações sem evidência (`2.400+`, `4,9/5` e “Mais vendido”) removidas.
- [x] Microcopy de acesso padronizada para “após confirmação do pagamento”.
- [x] Todos os links internos e anchors existentes retornam destinos válidos.
- [x] Nenhuma imagem quebrada, `alt` ausente, target pequeno, ID duplicado ou controle sem rótulo foi encontrado na matriz final.

## Problemas pendentes

### P0 — bloqueiam tráfego pago

- [ ] `https://escalahub.com` responde, mas atualmente publica outra aplicação: “EscalaHub - Gestão de escalas, plantões e turnos”. O domínio deve ser apontado para este projeto e toda a auditoria externa deve ser repetida.
- [x] O checkout agora integra o Mercado Pago (Pix e cartão) via `lib/payments/`, com criação de pagamento e webhook implementados. Ver `docs/MERCADO_PAGO.md`.
- [x] Cartão e CPF: número, validade e CVV são tokenizados no navegador pelo Mercado Pago.js e nunca chegam ao backend; apenas o CPF (documento de identificação, não sensível para PCI) é enviado ao servidor.
- [x] `trackPurchase` é chamado somente após o status autoritativo `approved`; usa `externalReference` como `transactionId` e `eventID` para deduplicação futura.
- [ ] Pedidos ainda usam memória local. Banco transacional é obrigatório antes de produção com múltiplas instâncias.
- [ ] A entrega automática/download protegido ainda não está conectado à aprovação.
- [ ] O dashboard não possui autenticação nem autorização. Ele só pode receber dados reais depois de login e RBAC.
- [x] Privacidade, Termos, Cookies e LGPD existem; os textos ainda exigem revisão jurídica antes da operação comercial.

### P1 — necessários antes de escalar campanhas

- [ ] Preencher e validar IDs reais de GA4, GTM e Meta Pixel no ambiente publicado.
- [ ] Evitar duplicidade de GA4/Meta quando as mesmas tags forem configuradas dentro do GTM.
- [ ] Implementar consentimento compatível com LGPD antes de ativar tags não essenciais.
- [ ] Validar a existência e o atendimento de `contato@escalahub.com`.
- [ ] Instalar monitoramento de erros, logs estruturados e Real User Monitoring.
- [ ] Executar Lighthouse e Core Web Vitals no domínio correto após o deploy.
- [ ] Adicionar testes end-to-end do pagamento, entrega e reembolso.

## Melhorias futuras

- CI com lint, TypeScript, build, auditoria e testes em cada pull request.
- Regressão visual automatizada para os 12 breakpoints auditados.
- Métricas reais de LCP, CLS, INP e TTFB por rota e dispositivo.
- Gestão server-side de produtos, clientes, pedidos e permissões.
- Entrega protegida e rastreável de arquivos digitais.
- Auditoria de acessibilidade contínua com axe e testes manuais por teclado/leitor de tela.

## Critérios de aprovação

- [x] Build concluído com sucesso.
- [x] TypeScript sem erros.
- [x] ESLint sem erros.
- [x] Responsividade validada localmente.
- [x] SEO técnico local revisado.
- [x] Performance front-end otimizada.
- [x] Acessibilidade revisada.
- [x] Links locais funcionando.
- [x] Componentes consistentes.
- [x] Sem código morto relevante.
- [x] Sem vulnerabilidades conhecidas no `npm audit`.
- [ ] Domínio correto publicado.
- [ ] Pagamento real e entrega validados ponta a ponta.
- [ ] Requisitos legais e de consentimento publicados.

A versão 1.0 deverá ser reavaliada após a conclusão dos três últimos critérios.
