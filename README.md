# Ciranda Web

Projeto da disciplina de Desenvolvimento Web (CEUB, Ciência da Computação). A Ciranda é um brechó online: quem tem roupa parada cadastra a peça, e quem procura encontra no catálogo. Este repositório traz o sistema de cadastros do brechó, com controle de acesso por perfil.

![CI](https://github.com/lucasamarale/ciranda-web/actions/workflows/ci.yml/badge.svg)

## O que foi pedido e onde está

| Requisito | Onde está |
| --- | --- |
| Back-end separado no diretório | `backend/` (Node, Express, SQLite) |
| Front-end com framework à escolha | `frontend/` (React com Vite) |
| Tailwind CSS e Materialize | `frontend/tailwind.config.js` e `frontend/src/estilo.css` |
| Identidade visual do CEUB | Paleta roxo e magenta em `frontend/tailwind.config.js` |
| CRUD 01: Usuário | `backend/src/rotas/usuarios.js` e tela Usuários |
| CRUD 02: Perfil | `backend/src/rotas/perfis.js` e tela Perfis |
| CRUD 03: Funcionalidades | `backend/src/rotas/funcionalidades.js` e tela Funcionalidades |
| Cobertura de testes de 80% | Limite de 80% configurado nos dois `vitest.config`; o CI falha abaixo disso |
| Cypress | `frontend/cypress/e2e/` (19 testes de ponta a ponta) |
| Mock, fixture e fake | Mock em `frontend/src/api.test.js`, fixtures em `frontend/cypress/fixtures/`, fake em `frontend/src/teste/apiFalsa.js` |
| GitHub Actions (CI/CD) | `.github/workflows/ci.yml` |
| Mobile | Layout responsivo, testado em 390 px no Cypress |
| Acessibilidade | Rótulos, foco visível, link de pular ao conteúdo, avisos com `role=status` e `role=alert` |
| CORS | `backend/src/seguranca.js`, lista de origens liberadas |
| Tokens | JWT de 30 minutos em `backend/src/auth.js` |
| Chave de API | Cabeçalho `X-API-Key` exigido em toda rota de `/api` |
| CSP | Helmet na API e meta tag no `frontend/index.html` |
| Firewall de camada 7 e WAF | Filtro de requisições e limite de taxa em `backend/src/seguranca.js` (ver observações) |

Além dos três cadastros pedidos, há um quarto, de peças, que alimenta o catálogo.

## Como o acesso funciona

Cada usuário tem um perfil, e cada perfil tem um conjunto de funcionalidades. O menu só mostra o que o perfil permite, e a API confere a permissão de novo a cada requisição, lendo o usuário no banco. Esconder o botão não basta: quem chamar a API direto também é barrado.

Contas de demonstração (senha `ciranda123`, dados fictícios):

| E-mail | Perfil | Enxerga |
| --- | --- | --- |
| lucia@ciranda.app | Administradora | Tudo |
| beatriz@ciranda.app | Fornecedor | Catálogo e peças |
| ana@ciranda.app | Cliente | Catálogo |

## Como rodar

Precisa do Node 20 ou mais novo.

```bash
# terminal 1: API em http://localhost:3333
cd backend
npm install
npm run dev

# terminal 2: site em http://localhost:5173
cd frontend
npm install
npm run dev
```

## Testes

```bash
cd backend && npm test          # 46 testes, com relatório de cobertura
cd frontend && npm test         # 37 testes, com relatório de cobertura
cd frontend && npm run build && npm run e2e   # sobe API e site e roda o Cypress
```

Cobertura medida na última execução: back-end 99,6% das linhas e front-end 100% das linhas. O relatório detalhado fica em `coverage/index.html` de cada pasta.

Os testes usam três tipos de dublê:

- **Mock:** `vi.fn()` no lugar do `fetch`, para conferir cabeçalhos e chamadas (`frontend/src/api.test.js`).
- **Fake:** uma API inteira em memória, com regras parecidas com as da real (`frontend/src/teste/apiFalsa.js`).
- **Fixture:** respostas prontas em JSON que o Cypress entrega no lugar do servidor (`frontend/cypress/fixtures/`).

No Cypress, os arquivos `01` e `02` rodam contra a API de verdade, e o `03` usa `cy.intercept` com fixtures para os casos difíceis de provocar, como servidor fora do ar e sessão vencida.

## Segurança

- **Chave de API:** toda rota de `/api` exige `X-API-Key`, comparada em tempo constante.
- **Tokens:** login devolve um JWT assinado, válido por 30 minutos. A senha fica guardada com bcrypt.
- **CORS:** só as origens em `CORS_ORIGENS` são aceitas.
- **CSP:** a API responde com `default-src 'none'`, e o site restringe scripts, estilos, imagens e conexões à própria origem.
- **Camada 7:** limite de requisições por minuto (mais apertado no login), corpo limitado a 100 kB e um filtro que recusa padrões conhecidos de ataque na URL e no corpo.
- **SQL:** todas as consultas usam parâmetros.

Observações honestas:

1. O filtro de requisições é uma proteção dentro da aplicação. Um WAF de verdade fica na frente do servidor (Cloudflare, AWS WAF, Vercel Firewall). Em produção, os dois andam juntos.
2. Chave de API em um site que roda no navegador não é segredo, porque qualquer pessoa consegue ler. Ela identifica o cliente autorizado; quem protege os dados é o token.
3. As cores seguem a identidade do CEUB por aproximação, sem uso do logotipo da instituição.

## Estrutura

```
backend/    API (Express), banco (SQLite) e testes (Vitest com Supertest)
frontend/   Site (React, Tailwind, Materialize), testes (Vitest, Testing Library) e Cypress
.github/    Pipeline do GitHub Actions
```

## Pipeline

A cada push ou pull request, o GitHub Actions roda os testes do back-end, os testes e o build do front-end, e depois o Cypress com a API e o site no ar. Na `main`, se tudo passar, o site pronto é publicado como artefato do workflow.
