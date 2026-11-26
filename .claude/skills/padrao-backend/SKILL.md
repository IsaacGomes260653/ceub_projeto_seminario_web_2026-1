---
name: padrao-backend
description: Padrão de arquitetura, API e segurança do back-end do Ciranda Web (NestJS, Prisma, Swagger, JWT, OWASP). Use ao criar ou revisar rota, tabela, migration, regra de acesso ou qualquer código do back-end.
---

# Padrão de back-end do Ciranda Web

Esta skill diz como escrever e como revisar o back-end deste projeto. Ela cobre dois blocos: **arquitetura e back-end** e **segurança e boas práticas**. Cada regra aponta o arquivo do repositório que serve de exemplo, para você copiar o que já existe em vez de inventar um jeito novo.

Antes de mexer em qualquer coisa, leia o arquivo de exemplo da seção. Depois de mexer, rode a conferência do fim desta página.

## Parte 1: Arquitetura e back-end

### 1.1 Framework: NestJS

O back-end é uma aplicação NestJS sobre Express, em TypeScript, na pasta `backend/`.

- **Módulo:** `backend/src/app.module.ts` registra controladores, serviços, a guarda global da chave de API e o filtro global de erros.
- **Controlador:** recebe a requisição, lê parâmetros e devolve o que o serviço responder. Não tem regra de negócio nem acesso ao banco.
- **Serviço:** tem a regra de negócio e fala com o banco pelo `PrismaService`.
- **Guarda:** decide se a requisição passa (chave de API, login, permissão). Ficam em `backend/src/comum/guardas.ts`.
- **Interceptador:** roda antes da rota. O `EmDia` (`backend/src/loja/reservas.ts`) solta as reservas vencidas.
- **Filtro de erros:** `backend/src/comum/filtro-de-erros.ts` transforma qualquer erro em `{ erro, detalhes }`.

Para criar um recurso novo, copie `backend/src/funcionalidades/funcionalidades.ts`, que é o CRUD mais simples: DTOs, serviço e controlador no mesmo arquivo. Depois registre o controlador e o serviço em `app.module.ts`.

Toda dependência entra pelo construtor com `@Inject(Classe)` explícito. Os testes rodam o TypeScript direto, sem os metadados de tipo, e sem o `@Inject` a injeção falha neles.

### 1.2 Web e APIs: HTTP

**Métodos.** Cada verbo tem um sentido só:

| Método | Uso | Exemplo |
| --- | --- | --- |
| GET | Ler. Nunca altera nada. | `GET /api/pecas` |
| POST | Criar, ou executar uma ação. | `POST /api/usuarios`, `POST /api/pedidos/7/pagar` |
| PUT | Substituir um recurso inteiro. | `PUT /api/perfis/2` |
| DELETE | Remover. | `DELETE /api/pecas/9` |

**Status codes.** Use o código que descreve o que aconteceu. Nunca devolva 200 com um erro dentro.

| Código | Quando |
| --- | --- |
| 200 | Leitura, edição ou ação que deu certo. |
| 201 | Recurso criado. |
| 204 | Deu certo e não há corpo (remoção, sair). |
| 400 | Dado inválido. O corpo traz `detalhes` com o erro de cada campo. |
| 401 | Falta chave de API, token, ou eles não valem. |
| 403 | Está logado, mas o perfil não tem a funcionalidade. Ou a origem não é permitida. |
| 404 | Não existe. Também é a resposta para recurso de outra pessoa. |
| 409 | Conflito com o estado atual: e-mail repetido, peça já reservada, perfil em uso. |
| 413 | Corpo maior que 100 kB. |
| 429 | Passou do limite de requisições. |
| 500 | Erro inesperado. A resposta é sempre `{ "erro": "Erro interno." }`. |

Para devolver um erro, lance `ErroHttp` ou um dos atalhos de `backend/src/comum/erros.ts` (`naoEncontrado`, `conflito`, `invalido`, `semAcesso`). Não monte a resposta de erro à mão no controlador.

**Headers.** Os que a API usa:

- `X-API-Key`: chave do cliente. Obrigatória em toda rota, menos `GET /api/saude`.
- `Authorization: Bearer <JWT>`: quem está logado.
- `Content-Type: application/json`: todo corpo é JSON.
- Cabeçalhos de segurança da resposta, postos pelo helmet em `backend/src/comum/seguranca.ts`: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- `RateLimit` e `RateLimit-Policy`: quanto resta do limite.

**Cookies.** A API grava um cookie só, `ciranda_sessao`, em `backend/src/auth/auth.controller.ts`. Todo cookie novo segue as mesmas quatro travas:

| Atributo | Para quê |
| --- | --- |
| `HttpOnly` | O JavaScript da página não lê. Um XSS não leva a sessão. |
| `Secure` | Só viaja por HTTPS (ligado em produção). |
| `SameSite=Strict` | O navegador não envia em requisição vinda de outro site. Barra CSRF. |
| `Path=/api/auth` | O cookie só acompanha as rotas que precisam dele. |

Nunca guarde em cookie um dado que o front precise ler. Nunca use cookie como credencial das rotas de dados: elas pedem o JWT no cabeçalho.

**CORS.** A lista de origens permitidas vem da variável `CORS_ORIGENS`. Origem fora da lista recebe 403 antes de chegar a qualquer rota (`corsRestrito` em `seguranca.ts`). Nunca use `*`, porque a API aceita credenciais.

### 1.3 APIs REST: documentação Swagger

A documentação é gerada do código e fica em `/api/docs` (página) e `/api/docs-json` (OpenAPI). A montagem está em `backend/src/app.ts`.

Toda rota nova precisa de:

1. `@ApiTags` no controlador.
2. `@ApiOperation({ summary })` dizendo o que a rota faz, em uma linha.
3. `@ApiBody({ type: Dto })` quando há corpo, com um DTO cujos campos têm `@ApiProperty({ type, example })`.
4. `@ApiResponse` para o sucesso e para cada erro que a rota pode devolver (400, 404, 409).
5. `@ComChaveDeApi()` e `@Autenticado(...)`, que também documentam o 401 e o 403.

O tipo vai sempre explícito no `@ApiProperty` (`type: String`, `type: [Number]`). DTO de resposta nunca tem campo de senha ou de hash.

Nomes de rota: substantivo no plural, em minúsculas, sem verbo (`/api/pecas`, não `/api/listarPecas`). Ação que não é CRUD vira sub-rota com POST (`/api/pedidos/:id/pagar`).

### 1.4 ORM e migrations: Prisma

Todo acesso ao banco passa pelo cliente do Prisma, injetado como `PrismaService` (`backend/src/banco/prisma.service.ts`). O esquema fica em `backend/prisma/schema.prisma`.

Para mudar o banco:

1. Edite `backend/prisma/schema.prisma`.
2. Rode `npm run migrar -- --name descricao_curta`. O Prisma cria uma pasta em `prisma/migrations` com o SQL.
3. Rode `npm run migracoes:empacotar`. O banco de demonstração é descartável e a API aplica as migrations ao subir, a partir de `src/banco/migracoes.ts`. Um teste falha se você esquecer este passo.
4. Faça o commit da migration. Migration que já foi para o repositório não se edita: crie outra.

Regras de uso:

- Quando duas gravações dependem uma da outra, use `prisma.$transaction`. Exemplo: fechar o pedido em `backend/src/loja/pedidos.ts`.
- Para evitar que duas pessoas mudem a mesma linha, troque a situação com `updateMany` e condição no `where`, e confira o `count`. Exemplo: reservar a peça em `backend/src/loja/sacola.ts`.
- Use `select` para escolher os campos devolvidos. É assim que o hash da senha nunca sai (`backend/src/usuarios/usuarios.ts`).
- Dado de outra pessoa se filtra no `where`, com o identificador de quem está logado. Nunca confie em identificador vindo do corpo.

### 1.5 Padrão de tabelas: tbl + número + nome

Toda tabela se chama `tbl_NNN_nome`: o prefixo `tbl`, um número de três dígitos e o nome no plural, em minúsculas, sem acento, com `_` entre as palavras.

| Tabela | Modelo no Prisma |
| --- | --- |
| `tbl_001_usuarios` | `Usuario` |
| `tbl_002_perfis` | `Perfil` |
| `tbl_003_funcionalidades` | `Funcionalidade` |
| `tbl_004_perfis_funcionalidades` | `PerfilFuncionalidade` |
| `tbl_005_pecas` | `Peca` |
| `tbl_006_sacola_itens` | `SacolaItem` |
| `tbl_007_pedidos` | `Pedido` |
| `tbl_008_pedidos_itens` | `PedidoItem` |
| `tbl_009_pedidos_eventos` | `PedidoEvento` |
| `tbl_010_sessoes` | `Sessao` |

Regras:

- A tabela nova recebe o próximo número livre. Número não se reaproveita nem se troca.
- No Prisma, o modelo tem nome no singular e campos em camelCase. O nome físico vai no `@@map("tbl_011_nome")` e, nas colunas, no `@map("nome_da_coluna")` em snake_case.
- Chave estrangeira termina em `_id` (`perfil_id`). Data termina em `_em` (`criado_em`).
- Toda relação declara o `onDelete` (`Cascade`, `Restrict` ou `SetNull`). Não deixe o padrão decidir.

O teste "padrão do banco" em `backend/test/plataforma.test.js` lê as tabelas do banco real e falha se alguma fugir do padrão. Ao criar uma tabela, acrescente o nome dela na lista do teste.

## Parte 2: Segurança e boas práticas

### 2.1 OWASP Top 10

**SQL injection.** O valor digitado nunca vira pedaço de SQL.

- Use os métodos do cliente do Prisma (`findMany`, `create`, `update`). Eles mandam os valores como parâmetros.
- Se precisar de SQL puro, use `$queryRaw` com template (`$queryRaw\`... WHERE id = ${id}\``), que também parametriza.
- `$queryRawUnsafe` e `$executeRawUnsafe` são proibidos com qualquer valor vindo de requisição. O único uso no projeto é aplicar as migrations, cujo SQL vem do repositório.
- Identificador de rota passa por `lerId`, que só aceita inteiro positivo.

**XSS.** Nada que a pessoa digitou é executado como código.

- A API só devolve JSON, com `Content-Security-Policy: default-src 'none'`.
- No front, o React escapa todo texto. É proibido usar `dangerouslySetInnerHTML`.
- A CSP do site (`vercel.json`) só permite script do próprio domínio.
- O token de sessão longa fica em cookie `HttpOnly`, fora do alcance de script.
- O filtro de requisições em `seguranca.ts` recusa corpo com `<script`, `onerror=` e `javascript:`. Ele é uma camada a mais, não a defesa principal.

**CSRF.** Um site de fora não consegue agir em nome de quem está logado.

- As rotas de dados não aceitam cookie. Elas pedem o JWT no cabeçalho `Authorization`, que o navegador nunca envia sozinho.
- O cookie de sessão é `SameSite=Strict` e só vale em `/api/auth`.
- Toda rota pede o cabeçalho `X-API-Key`. Um formulário em outro site não consegue enviar cabeçalho próprio.
- Requisição com `Origin` fora da lista recebe 403.

**Controle de acesso** (o primeiro item do Top 10). Toda rota declara quem pode usá-la.

- `@Autenticado("chave.da.funcionalidade")` no controlador ou na rota. Sem a chave no perfil, a resposta é 403.
- Recurso de outra pessoa responde 404, não 403, para não revelar que existe.
- Campo sensível nunca vem do formulário: perfil no cadastro aberto, dono e situação na consignação, e preço no pedido são definidos pelo servidor.

**Força bruta e abuso.** Limite de 120 requisições por minuto por IP, e de 10 por minuto em login, cadastro e renovação. O login responde a mesma mensagem para e-mail errado, senha errada e conta desativada.

### 2.2 Proteção de dados

**Hash de senhas.**

- Senha é gravada com bcrypt (`bcryptjs`), custo 10. Nunca em texto, nunca com MD5 ou SHA puro.
- O hash nunca sai da API: as consultas usam `select` sem o campo `senhaHash`.
- Senha nunca aparece em log, em mensagem de erro nem na documentação.
- Quando o e-mail não existe, o login compara com um hash falso, para o tempo de resposta não entregar quem tem conta.

**Criptografia.**

- O JWT é assinado com HMAC SHA-256 (HS256). O algoritmo é fixado na verificação.
- O token de renovação tem 32 bytes aleatórios de `crypto.randomBytes`. No banco fica só o SHA-256 dele.
- Comparação de segredo usa `crypto.timingSafeEqual` (chave de API em `guardas.ts`).
- Número aleatório de segurança vem sempre de `node:crypto`, nunca de `Math.random`.

**HTTPS.**

- Em produção o site só responde por HTTPS (a hospedagem redireciona o HTTP).
- A API manda `Strict-Transport-Security`, que faz o navegador recusar HTTP nas visitas seguintes.
- O cookie de sessão sai com `Secure` em produção.

### 2.3 Segurança de aplicação

**Validação de entrada.** Tudo o que chega é validado no servidor, mesmo que o front já valide.

- Todo corpo e toda consulta passam por `validar(dados, REGRAS)` (`backend/src/comum/validar.ts`) no começo do método do serviço.
- A regra é uma lista de permissão: campo que não está nela é descartado.
- Cada campo tem tipo, obrigatoriedade e limites (`min`, `max`). Lista fechada de valores usa `opcoes`. Formato usa `padrao` com expressão regular.
- O erro volta com status 400 e a mensagem de cada campo em `detalhes`.
- O corpo tem teto de 100 kB.

**Gestão de segredos.**

- Segredo vive em variável de ambiente, lida em um lugar só: `backend/src/config.ts`.
- `backend/.env.example` lista as variáveis com valores de mentira. O `.env` de verdade está no `.gitignore`.
- Em produção a API não sobe sem `JWT_SEGREDO` e `API_KEY`.
- Nunca escreva segredo em código, teste, commit, log ou resposta. Se um segredo vazar, troque-o. Apagar o commit não resolve.
- A senha `ciranda123` das contas de demonstração é pública de propósito: os dados são fictícios.

### 2.4 JWT: comunicação com o front

O front e a API conversam com dois tokens, cada um guardado onde é mais seguro.

| | JWT de acesso | Token de renovação |
| --- | --- | --- |
| Duração | 30 minutos | 7 dias |
| Onde fica | `sessionStorage` da aba | Cookie `HttpOnly` |
| Como viaja | Cabeçalho `Authorization: Bearer` | O navegador envia sozinho, só para `/api/auth` |
| Para que serve | Todas as rotas de dados | Só pedir um JWT novo |

Fluxo:

1. `POST /api/auth/login` devolve `{ token, usuario }` e grava o cookie.
2. O front guarda o token (`frontend/src/api.js`) e o envia em toda chamada.
3. A guarda de autenticação confere a assinatura e o prazo, e carrega o usuário **do banco** a cada requisição. O JWT só leva o identificador (`sub`). Mudar um perfil ou desativar uma conta vale na requisição seguinte.
4. Quando o JWT vence, a API responde 401. O front chama `POST /api/auth/renovar`, recebe outro JWT e repete a chamada.
5. O token de renovação é de uso único: a cada troca ele é apagado e nasce outro.
6. `POST /api/auth/sair` apaga a sessão no banco e o cookie.

Regras:

- Nada de dado sensível dentro do JWT: qualquer pessoa consegue ler o conteúdo dele.
- O algoritmo é fixado em HS256 ao verificar. Token com outro algoritmo é recusado.
- O JWT não vai em URL nem em cookie.

## Conferência antes de entregar

Rode na pasta `backend/`:

```bash
npx prisma validate   # o esquema está certo
npm test              # testes e cobertura mínima de 80%
npm run build         # o TypeScript compila
```

E confira, para cada rota nova ou alterada:

- [ ] Tem `@Autenticado` com a funcionalidade certa, ou um motivo escrito para ser aberta.
- [ ] Valida o corpo e a consulta com `validar`.
- [ ] Devolve o status code da tabela da seção 1.2.
- [ ] Está documentada no Swagger, com os erros possíveis.
- [ ] Filtra pelo dono quando o dado é de uma pessoa.
- [ ] Não devolve hash, segredo nem campo interno.
- [ ] Tem teste do caminho feliz e de pelo menos um erro.
- [ ] Tabela nova segue `tbl_NNN_nome` e tem migration no repositório.
