# Deploy da EscalaHub

## GitHub

O repositório oficial é `Arrudawokk/teste-site-`. O fluxo recomendado é trabalhar em branch, executar as validações e integrar na `main` somente com build aprovado.

```bash
git checkout -b nome-da-alteracao
npm install
npm run lint
npm run type-check
npm run build
git push -u origin nome-da-alteracao
```

Nunca versionar `.env.local`, tokens, chaves ou credenciais.

## Vercel

1. Importe o repositório GitHub na Vercel.
2. Selecione o preset Next.js.
3. Mantenha `npm run build` como comando de build.
4. Cadastre as variáveis no ambiente correto.
5. Publique primeiro em Preview e valide Home, produto, checkout, sitemap e robots.
6. Promova para Production e configure o domínio canônico.

## Variáveis de ambiente

Obrigatórias em produção:

- `NEXT_PUBLIC_SITE_URL`: URL canônica, com HTTPS e sem barra final.
- `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`: chave pública usada pelo Mercado Pago.js no navegador.
- `MERCADO_PAGO_ACCESS_TOKEN`: credencial privada usada somente no servidor.
- `MERCADO_PAGO_WEBHOOK_SECRET`: segredo privado para validar notificações.

Opcionais, apenas com IDs reais:

- `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`: Measurement ID do GA4.
- `NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID`: Container ID do GTM.
- `NEXT_PUBLIC_META_PIXEL_ID`: Pixel ID da Meta.

Use `.env.example` como referência. A ausência de um ID mantém a integração correspondente desativada.

As três credenciais do Mercado Pago devem pertencer ao mesmo ambiente. O checkout recusa criar cobranças quando a URL pública não está configurada com HTTPS.

## Analytics e Pixel

- `PageView` é enviado globalmente.
- `ViewContent` recebe slug, título, preço e moeda do produto visitado.
- `InitiateCheckout` recebe os dados do produto selecionado no checkout.
- `Purchase` está preparado em `lib/analytics.ts`, mas só deve ser chamado após confirmação real e idempotente do pagamento no servidor.

Não dispare `Purchase` por clique, envio de formulário ou página de agradecimento sem validação do provedor.

## Checklist após deploy

- confirmar que `NEXT_PUBLIC_SITE_URL` corresponde ao domínio final;
- abrir `/robots.txt`, `/sitemap.xml` e um produto publicado;
- validar canonical, Open Graph, Twitter Card e JSON-LD;
- validar checkout com e sem `?product=slug`;
- conferir eventos nas ferramentas de depuração do GA4, GTM e Meta;
- confirmar que tags não essenciais só serão ativadas depois da implementação do consentimento aplicável;
- confirmar headers de segurança e HTTPS;
- homologar assinatura, reenvio e reconciliação do webhook em Preview;
- executar uma compra real somente depois da integração de pagamento homologada.
