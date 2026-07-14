# Área do Cliente

## Arquitetura

A área do cliente usa o catálogo existente como fonte dos dados de produto e os pedidos persistidos como fonte dos direitos de acesso. A interface nunca decide se um cliente pode acessar ou baixar um item.

- `lib/account/store.ts`: persistência abstrata de contas e sessões.
- `lib/account/session.ts`: cookie de sessão opaco, criação, leitura e revogação.
- `lib/account/data.ts`: camada server-side que produz DTOs seguros para biblioteca, pedidos e perfil.
- `app/account`: visão geral, biblioteca, pedidos, perfil, login, loading e tratamento de erro.
- `app/api/account/download`: download autenticado e autorizado.
- `lib/storage/privateAssets.ts`: contrato de armazenamento privado e adaptador HTTP atual.

## Autenticação

Um pagamento aprovado permite criar uma sessão de 30 dias. O navegador recebe apenas um token aleatório de 256 bits em cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção e escopo `/`. O banco armazena somente o hash SHA-256 do token.

O checkout e o endpoint de status criam a sessão após a confirmação. Para recuperação, `/account/entrar` exige o e-mail da compra e o UUID completo de um pedido aprovado. A validação ocorre no servidor. O logout revoga a sessão no banco.

## Biblioteca e pedidos

`OrderStore.listByPayerEmail` busca os pedidos do titular da sessão. A biblioteca inclui somente o pedido mais recente por produto com `payment_status = approved` e `access_status = granted`. Os dados visuais vêm de `lib/catalog`, portanto novos produtos aparecem sem páginas específicas.

O histórico expõe somente informações próprias e não sensíveis: identificador, produto, valor, estado, data, gateway e forma de pagamento.

## Entrega e downloads

O webhook e a reconciliação do Mercado Pago continuam atualizando pagamento e acesso na mesma transação. A área do cliente não concede direitos; ela apenas lê essa decisão.

O download autenticado executa, a cada solicitação:

1. validação da sessão;
2. busca server-side do pedido;
3. comparação do titular pelo e-mail normalizado;
4. confirmação de pagamento aprovado e acesso concedido;
5. resolução do arquivo pelo adaptador privado;
6. streaming com `no-store`, `nosniff` e nome de arquivo seguro.

O arquivo nunca é colocado em `public`. O adaptador atual usa as variáveis de origem privada já existentes. Vercel Blob, Amazon S3 e Cloudflare R2 podem ser adicionados implementando `PrivateAssetStore`, sem mudar as rotas ou a biblioteca.

## Banco de dados

Execute as migrações na ordem:

1. `db/migrations/001_payment_orders.sql`
2. `db/migrations/002_customer_accounts.sql`

A segunda migração adiciona nome do pagador, gateway, contas e sessões. Ela é aditiva e idempotente.

## E-mails

`lib/email` contém contratos, serviço e templates para compra aprovada, pagamento pendente, reembolso e entrega. Nenhum provedor ou credencial fictícia foi incluído. Para ativar, implemente `EmailProvider`, conecte-o a uma fila persistente e instancie `TransactionalEmailService` no processador assíncrono.

## Segurança operacional

- aplicar rate limiting distribuído em `/account/entrar`;
- expirar e remover sessões antigas periodicamente;
- monitorar tentativas de recuperação e falhas de download;
- utilizar pooler no PostgreSQL;
- manter a origem do produto privada;
- validar reembolso e chargeback em sandbox antes da publicação.
