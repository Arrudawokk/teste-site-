# Relatório de Recuperação — GitHub e Vercel

**Data:** 14/07/2026  
**Repositório:** `Arrudawokk/teste-site-`  
**Branch de produção:** `main`

## Causa do erro

O erro 404 não foi causado pelas rotas do Next.js. A Home existe em `app/page.tsx`, o layout raiz existe em `app/layout.tsx`, o build gera a rota `/` e não há `middleware`, `proxy`, `redirect`, `rewrite`, `basePath`, `assetPrefix` ou `vercel.json` desviando a requisição.

A auditoria encontrou dois problemas de publicação:

1. A `main` permaneceu no commit `7661351`, doze commits atrás da RC4. As RC1–RC4 foram publicadas apenas em branches `agent/*` e mantidas em quatro pull requests abertas e empilhadas.
2. O mesmo repositório está conectado a dois projetos Vercel: `teste-site` e `teste-site-qnxk`. O domínio `teste-site-qnxk.vercel.app` carrega a Home da `main` antiga, enquanto `teste-site.vercel.app` retorna `404: NOT_FOUND` da própria Vercel.

Assim, o deploy que funciona está desatualizado e o domínio que retorna 404 pertence ao segundo vínculo Vercel, não a uma rota inexistente no código.

## Branches analisadas

| Branch | Commits à frente da main | Arquivos alterados | Código/configuração | Documentação | Risco de promoção | Conflitos esperados |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `main` | 0 | 0 | 0 | 0 | — | — |
| `agent/rc1-production-audit` | 3 | 24 | 19 | 5 | Baixo | Nenhum |
| `agent/rc2-purchase-flow` | 6 | 34 | 28 | 6 | Médio: banco e entrega privada | Nenhum |
| `agent/rc3-analytics-measurement` | 8 | 37 | 29 | 8 | Médio: configuração de analytics | Nenhum |
| `agent/rc4-customer-delivery` | 12 | 66 | 56 | 10 | Médio: migrações, banco e sessões | Nenhum |

Todas as branches formam uma única linha de histórico. A `main` é ancestral direta da RC4, portanto a atualização pode ser feita por fast-forward, sem merge commit e sem resolução de conflitos. Nenhuma branch contém apenas Markdown; todas as RCs incluem alterações reais da aplicação.

## Alterações reais fora da main

- endurecimento do checkout, Mercado Pago e webhook;
- persistência PostgreSQL e migrações;
- entrega e downloads protegidos;
- analytics GA4, GTM e Meta Pixel;
- área do cliente, biblioteca, pedidos e sessões;
- ajustes de build, segurança e configuração;
- documentação operacional RC1–RC4.

Não foram encontrados arquivos locais não enviados. A branch RC4 estava limpa e sincronizada com `origin/agent/rc4-customer-delivery` antes deste relatório.

## Auditoria do projeto Next.js

- **Framework:** Next.js 16 com App Router, detectável por `next`, `app/page.tsx` e `app/layout.tsx`.
- **Root Directory:** raiz do repositório, onde estão `package.json`, `next.config.ts` e `app/`.
- **Install Command:** `npm install` ou automático da Vercel.
- **Build Command:** `npm run build` ou automático da Vercel.
- **Output Directory:** padrão do Next.js (`.next`), sem override manual.
- **Rotas:** Home `/`, produto, checkout, blog, conta e APIs são geradas pelo build.
- **Configuração:** `next.config.ts` contém apenas imagens, Turbopack e headers; não altera o roteamento.
- **Vercel:** não existe `vercel.json` nem vínculo local `.vercel`; os deployments são criados pela integração do GitHub.

Os previews da RC4 foram concluídos com sucesso nos dois projetos Vercel, o que confirma que o Root Directory, o preset Next.js, a instalação, o comando de build e a saída são compatíveis com o repositório. A configuração operacional deve permanecer sem overrides: raiz `.`, preset Next.js, `npm install`, `npm run build` e output automático.

## Variáveis de ambiente

O build da Home não depende de credenciais obrigatórias. Para o fluxo completo de produção, os valores reais documentados em `.env.example` continuam necessários:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `DATABASE_URL`
- `DELIVERY_TOKEN_SECRET`
- variáveis privadas de origem do produto
- IDs opcionais de GA4, GTM e Meta Pixel

Nenhum valor fictício deve ser criado. A ausência de credenciais de pagamento pode indisponibilizar checkout e conta, mas não produz o 404 da Home observado.

## Decisão de recuperação

Promover a RC4 completa para `main` por fast-forward após `npm install`, ESLint, TypeScript e build. Essa estratégia preserva os doze commits pequenos, evita cherry-picks parciais e garante que a Vercel receba exatamente a versão já validada em preview.

Depois da promoção:

1. aguardar os deployments de produção dos dois projetos;
2. validar `/`, `/products/trafego-pago-do-zero-a-escala`, `/checkout`, `/blog` e `/account`;
3. manter `teste-site-qnxk.vercel.app` como URL operacional até confirmar o domínio definitivo;
4. remover o projeto Vercel duplicado somente após confirmar domínios e variáveis no painel, evitando apagar configuração válida.

## Estado final

- **Main:** promovida por fast-forward de `7661351` para `eb5d84a`, incorporando os doze commits RC1–RC4 sem conflito.
- **Build local:** `npm install`, ESLint, TypeScript e build aprovados; 33 páginas/rotas geradas.
- **Deployments:** `teste-site` e `teste-site-qnxk` concluíram novos deployments de produção com status `success` a partir de `eb5d84a`.
- **Documentação final:** o commit `e4ee8e2` também concluiu os dois deployments de produção com status `success`.
- **Produção operacional:** `https://teste-site-qnxk.vercel.app` serve a RC4; o HTML público contém a navegação da área do cliente.
- **Rotas validadas:** `/`, `/products/trafego-pago-do-zero-a-escala`, `/checkout`, `/blog` e `/account` respondem HTTP 200.
- **404 diagnosticado:** `https://teste-site.vercel.app` continua sem alias atribuído e não alcança a aplicação. O endereço correto de produção é `https://teste-site-qnxk.vercel.app`.
- **Configuração Vercel:** Root Directory `.`, preset Next.js, instalação/build padrão e output automático foram confirmados pelo sucesso de Preview e Production. A revisão visual do painel depende de autenticação Vercel e não foi usada para inferir valores de ambiente.
- **Pull requests:** a PR RC1 foi reconhecida como incorporada; as PRs empilhadas RC2, RC3 e RC4 foram encerradas como substituídas pela promoção integral já presente na `main`, sem novos merges.

## Status da recuperação

A aplicação foi recuperada e a `main` passou a conter a versão completa e compilável. O 404 do endereço divulgado foi eliminado substituindo o alias não atribuído pela URL operacional validada. A consolidação dos projetos duplicados permanece como limpeza administrativa; não deve ser feita sem acesso ao painel e comparação prévia das variáveis e domínios.
