# EscalaHub RC1 — Auditoria de produção

Data: 13 de julho de 2026  
Escopo: aplicação completa, integração Mercado Pago, segurança, checkout, performance, SEO, analytics, acessibilidade e responsividade.

## Resultado executivo

**Status: aprovada para homologação, ainda não aprovada para tráfego pago em produção.**

A RC1 compila sem erros, possui uma base técnica consistente e teve os principais riscos corrigíveis desta sprint eliminados. A liberação comercial continua bloqueada por três dependências que exigem infraestrutura ou produto fora do escopo autorizado: persistência transacional de pedidos, entrega real do produto e autenticação do dashboard.

## Validações executadas

- `npm install`: concluído; 365 pacotes instalados e zero vulnerabilidades reportadas nessa instalação.
- `npm run lint`: concluído sem erros.
- `npm run type-check`: concluído sem erros.
- `npm run build`: concluído sem erros ou warnings do Next.js.
- Build gerou 25 páginas/rotas, incluindo rotas estáticas, SSG e APIs dinâmicas.
- Auditoria visual automatizada em 39 combinações: 13 rotas em 360, 768 e 1366 px.
- Nenhum overflow horizontal, imagem quebrada, página sem `h1` único ou controle sem rótulo foi encontrado.
- Home, produto e checkout foram inspecionados visualmente em desktop e mobile.
- Nenhum segredo ou arquivo de ambiente foi encontrado no conteúdo versionado ou nos nomes de objetos do histórico Git.

## Problemas encontrados e corrigidos

### Arquitetura e qualidade

- Criados `.gitignore` e `.env.example`; artefatos, dependências e segredos locais deixaram de aparecer como arquivos versionáveis.
- Corrigida a raiz do Turbopack para evitar resolução pelo projeto pai.
- Mantida a abstração `PaymentGateway`; nenhuma rota passou a depender diretamente do SDK concreto.
- Documentação de deploy e Mercado Pago atualizada para refletir o repositório e o fluxo reais.
- Removida a dependência de rede do Google Fonts durante o build, tornando a compilação reproduzível em ambiente restrito.

### Segurança e Mercado Pago

- Corpo da criação de pagamento limitado a 16 KiB e validado antes do processamento.
- Origem do POST de checkout validada contra a origem da aplicação.
- Nome, e-mail, CPF, token, método e parcelamento receberam limites e formatos explícitos.
- `NEXT_PUBLIC_SITE_URL` passou a ser obrigatório e HTTPS para criar cobranças.
- Idempotência passou a nascer no cliente e permanecer estável em reenvios após falha de rede.
- Pedido pendente agora é registrado antes da chamada ao gateway, eliminando a corrida com o webhook.
- Reenvios com a mesma chave reconciliam o pagamento existente em vez de criar uma nova cobrança.
- Webhook continua validando HMAC e janela temporal pelo SDK oficial.
- Falha de assinatura retorna `401`; indisponibilidade temporária do Mercado Pago retorna `503` com `Retry-After`, permitindo nova tentativa.
- ID, referência externa, método, valor, moeda e e-mail do pagamento são comparados ao pedido antes da atualização.
- Estados terminais não podem regredir por replay ou evento fora de ordem.
- `authorized` deixou de ser tratado como pagamento aprovado; agora permanece em processamento até confirmação.
- Respostas de criação, status e webhook usam `Cache-Control: no-store`.
- IDs numéricos do gateway são validados como inteiros positivos seguros.

### Checkout e UX

- Checkout envia `X-Idempotency-Key` e preserva a chave em falhas incertas.
- Respostas não JSON do backend agora recebem mensagem segura em vez de quebrar o fluxo.
- Polling de status usa `no-store`.
- Tela posterior ao pagamento distingue aprovado, pendente, recusado, cancelado, reembolsado e contestado.
- Estados negativos deixaram de usar ícone e cor de sucesso e agora permitem nova tentativa.
- QR Code base64 passou a usar `Next/Image` sem exceção de ESLint.
- CSP passou a permitir o formulário `mailto:` existente sem abrir origens adicionais de script.

### Performance, SEO e analytics

- Imagens LCP da Home e produto usam preload e não geram warning no build final.
- SEO já continha metadata, canonical, Open Graph, Twitter Cards, sitemap, robots, manifest e JSON-LD por produto/artigo; a auditoria não encontrou rota indexável sem esses fundamentos.
- IDs de GA4, GTM e Meta agora são validados antes de carregar scripts.
- `Purchase` envia `eventID` igual ao `transactionId`, preparando deduplicação futura com Meta Conversions API.
- Headers existentes de CSP, HSTS, anti-framing, MIME sniffing, referrer e permissions policy foram preservados.

## Problemas pendentes

### P0 — bloqueiam produção comercial

1. **Pedidos somente em memória.** Deploy, cold start ou múltiplas instâncias podem perder pedidos e impedir reconciliação. Implementar `OrderStore` em banco transacional com índices únicos para `externalReference` e `gatewayPaymentId`.
2. **Entrega do produto inexistente.** O pagamento pode ser aprovado, mas não há envio transacional nem download protegido. Conectar a aprovação a uma entrega idempotente antes de vender.
3. **Dashboard sem autenticação e autorização.** A rota é pública e contém dados demonstrativos. Não conectar dados reais antes de login, sessão segura e RBAC.
4. **Consentimento de analytics/marketing.** GA4, GTM e Meta Pixel carregam quando configurados; antes de ativá-los, implementar consentimento compatível com a base legal adotada e revisão jurídica.

### P1 — antes de escalar

- Rate limiting distribuído/WAF para criação e consulta de pagamentos.
- Logs estruturados, correlação por pedido, alertas de webhook e monitoramento de erros.
- Testes E2E no ambiente de teste do Mercado Pago cobrindo Pix, cartão aprovado/recusado, timeout, replay, reembolso e chargeback.
- Persistência da deduplicação de eventos e futura Conversions API/Enhanced Conversions.
- Evitar dupla medição quando GA4 ou Meta também forem configurados dentro do GTM.
- Homologar credenciais do mesmo ambiente e webhook no domínio definitivo.
- Revisão jurídica final dos textos de privacidade, cookies, termos, garantia e LGPD.
- Validar existência e operação do e-mail de suporte publicado.
- CI obrigatório com instalação limpa, lint, TypeScript, build e testes.

## Notas

| Área | Nota | Justificativa |
| --- | ---: | --- |
| Arquitetura | 8,3/10 | Boa separação de catálogo, UI e gateway; persistência concreta ainda ausente. |
| Segurança | 7,4/10 | Webhook e reconciliação endurecidos; faltam rate limit, autenticação e persistência. |
| Performance | 9,0/10 | Build estático amplo, imagens otimizadas, LCP priorizado e zero overflow na matriz. |
| Escalabilidade | 6,2/10 | Catálogo e contratos escalam, mas pedidos em memória impedem horizontalização. |
| Prontidão para produção | 6,8/10 | RC1 pronta para homologação; os P0 impedem venda real segura em escala. |

## Critério de liberação

A aplicação deve ser reavaliada depois que os quatro itens P0 estiverem concluídos e um ciclo completo de compra, webhook, entrega, reembolso e analytics tiver sido homologado no domínio final.
