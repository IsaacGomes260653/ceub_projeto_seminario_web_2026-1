# Ciranda Web

Projeto da disciplina de Desenvolvimento Web (CEUB, Ciência da Computação). A Ciranda é um brechó online: quem tem roupa parada deixa a peça em consignação, e quem procura reserva, paga e acompanha o pedido. Este repositório traz os cadastros pedidos na disciplina, com controle de acesso por perfil, e a loja inteira em volta deles.

![CI](https://github.com/lucasamarale/ciranda-web/actions/workflows/ci.yml/badge.svg)

**No ar:** https://ciranda-web.vercel.app

**Equipe:** Bruno Rodrigues dos Santos, Eduardo Clemente, Isaac Gomes de Moraes e Lucas Amaral Evangelista

## O que foi pedido e onde está

| Requisito | Onde está |
| --- | --- |
| Back-end separado no diretório | `backend/` (Node, Express, SQLite) |
| Front-end com framework à escolha | `frontend/` (React com Vite) |
| Tailwind CSS e Materialize | `frontend/tailwind.config.js` e `frontend/src/estilo.css` |
| Identidade visual do CEUB | Paleta oficial da Central da Marca em `frontend/tailwind.config.js` |
| CRUD 01: Usuário | `backend/src/rotas/usuarios.js` e tela Usuários |
| CRUD 02: Perfil | `backend/src/rotas/perfis.js` e tela Perfis |
| CRUD 03: Funcionalidades | `backend/src/rotas/funcionalidades.js` e tela Funcionalidades |
| Cobertura de testes de 80% | Limite de 80% configurado nos dois `vitest.config`; o CI falha abaixo disso |
| Cypress | `frontend/cypress/e2e/` (29 testes de ponta a ponta) |
| Mock, fixture, fake e stub | Mock em `frontend/src/api.test.js`, fixtures em `frontend/cypress/fixtures/`, fake em `frontend/src/teste/apiFalsa.js`, stub da arara em `frontend/cypress/e2e/03-simulado.cy.js` |
| GitHub Actions (CI/CD) | `.github/workflows/ci.yml` para os testes, e publicação automática na Vercel a cada push na `main` |
| Mobile | Layout responsivo, testado em 390 px no Cypress |
| Acessibilidade | Rótulos, foco visível, link de pular ao conteúdo, avisos com `role=status` e `role=alert` |
| CORS | `backend/src/seguranca.js`, lista de origens liberadas |
| Tokens | JWT de 30 minutos em `backend/src/auth.js` |
| Chave de API | Cabeçalho `X-API-Key` exigido em toda rota de `/api` |
| CSP | Helmet na API e meta tag no `frontend/index.html` |
| Firewall de camada 7 e WAF | Firewall da Vercel na borda, com regra própria, mais o filtro de requisições e o limite de taxa em `backend/src/seguranca.js` |

Além dos três cadastros pedidos, há um quarto, de peças, que alimenta o catálogo.

## A loja

Tudo o que o Ciranda original fazia, agora com servidor, permissão por funcionalidade e testes:

| Função | Como funciona | Onde está |
| --- | --- | --- |
| Cadastro aberto | Qualquer pessoa cria conta e entra sempre como Cliente. O perfil nunca vem do formulário. | `backend/src/rotas/auth.js`, tela Criar conta |
| Sacola com reserva | Colocar na sacola reserva a peça por 30 minutos. Duas pessoas não reservam a mesma peça, e a reserva vencida volta sozinha ao catálogo. | `backend/src/rotas/sacola.js`, `backend/src/reservas.js` |
| Pix simulado | Fechar a sacola gera um pedido com código Pix de mentira e prazo. Um botão faz o papel do banco. Nenhum dinheiro circula. | `backend/src/rotas/pedidos.js`, tela do pedido |
| Pedidos e rastreio | Linha do tempo de Pago a Entregue, com histórico e código de rastreio simulado. Cada pessoa vê só os próprios pedidos. | `backend/src/rotas/pedidos.js` |
| Consignação | A pessoa envia a peça, o brechó aprova ou recusa com motivo, e a venda gera repasse de 60% para quem enviou. | `backend/src/rotas/consignacao.js`, telas Vender e Bastidores |
| Impacto e pontos | Cada peça mostra a água e o carbono que poupa. Cada compra paga soma pontos. Categoria sem fator confiável não mostra número. | `backend/src/impacto.js`, `frontend/src/impacto.js` |
| Bastidores | Vendido, a repassar, fila de consignação e pedidos para mover de etapa. | `backend/src/rotas/painel.js`, tela Bastidores |

Quatro funcionalidades novas entram no cadastro de funcionalidades e podem ser dadas a qualquer perfil: `sacola.usar`, `consignacao.publicar`, `consignacao.aprovar` e `bastidores.ver`.

Para ver tudo em cinco minutos: entre como Ana, abra uma peça, coloque na sacola, feche o pedido e confirme o Pix simulado. Em Vender, envie uma peça. Depois entre como Lúcia e abra Bastidores para aprovar a peça e mover o pedido.

## A arara 3D

No topo do catálogo, as peças de cima (camiseta, camisa, moletom e jaqueta) ficam penduradas em uma arara 3D que gira com o mouse ou o dedo. Escolher uma peça, na arara ou na lista, abre a página dela, onde a peça gira em 3D e mostra marca, tamanho, conservação, número de voltas e a estimativa de água e carbono que aquela volta poupa (fatores em `frontend/src/impacto.js`, os mesmos do Ciranda original). O pacote 3D só é baixado quando o catálogo abre, e em aparelho sem WebGL a arara some e a lista continua inteira, então nada depende dela para funcionar.

Cada tecido tem a sua trama: malha nas camisetas e moletons, tela no linho das camisas e sarja no jeans das jaquetas. O pano atrasa, balança e assenta quando a peça gira.

O código que liga a arara ao catálogo está em `frontend/src/arara.js` e `frontend/src/componentes/Arara.jsx`. O pacote compilado fica em `frontend/public/arara3d/`.

## Como o acesso funciona

Cada usuário tem um perfil, e cada perfil tem um conjunto de funcionalidades. O menu só mostra o que o perfil permite, e a API confere a permissão de novo a cada requisição, lendo o usuário no banco. Esconder o botão não basta: quem chamar a API direto também é barrado.

Contas de demonstração (senha `ciranda123`, dados fictícios):

| E-mail | Perfil | Enxerga |
| --- | --- | --- |
| lucia@ciranda.app | Administradora | Tudo |
| beatriz@ciranda.app | Fornecedor | Catálogo e peças |
| ana@ciranda.app | Cliente | Catálogo |

## Como rodar

Precisa do Node 22.13 ou mais novo, porque a API usa o SQLite que já vem no Node.

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
cd backend && npm test          # 73 testes, com relatório de cobertura
cd frontend && npm test         # 98 testes, com relatório de cobertura
cd frontend && npm run build && npm run e2e   # sobe API e site e roda o Cypress
```

Cobertura medida na última execução: back-end 99,8% das linhas e front-end 100% das linhas. O relatório detalhado fica em `coverage/index.html` de cada pasta.

Os testes usam três tipos de dublê:

- **Mock:** `vi.fn()` no lugar do `fetch`, para conferir cabeçalhos e chamadas (`frontend/src/api.test.js`).
- **Fake:** uma API inteira em memória, com regras parecidas com as da real (`frontend/src/teste/apiFalsa.js`).
- **Fixture:** respostas prontas em JSON que o Cypress entrega no lugar do servidor (`frontend/cypress/fixtures/`).

No Cypress, os arquivos `01`, `02` e `04` rodam contra a API de verdade (o `04` percorre a loja inteira, da conta nova ao repasse), e o `03` usa `cy.intercept` com fixtures para os casos difíceis de provocar, como servidor fora do ar e sessão vencida.

## Segurança

- **Chave de API:** toda rota de `/api` exige `X-API-Key`, comparada em tempo constante.
- **Tokens:** login devolve um JWT assinado, válido por 30 minutos. A senha fica guardada com bcrypt.
- **CORS:** só as origens em `CORS_ORIGENS` são aceitas.
- **CSP:** a API responde com `default-src 'none'`, e o site restringe scripts, estilos, imagens e conexões à própria origem.
- **Camada 7:** limite de requisições por minuto (mais apertado no login), corpo limitado a 100 kB e um filtro que recusa padrões conhecidos de ataque na URL e no corpo.
- **SQL:** todas as consultas usam parâmetros.
- **Dados de cada pessoa:** sacola, pedidos e peças em consignação são filtrados pelo dono no servidor. Pedido de outra pessoa responde 404, para não revelar que o número existe.

Observações honestas:

1. São duas camadas. Na borda, o firewall da Vercel faz a mitigação automática de ataques de volume e aplica uma regra nossa, que nega caminhos típicos de varredura (`/.env`, `/.git`, `/wp-admin` e parecidos) antes de chegarem ao site. Dentro da aplicação, o filtro de requisições é um complemento, não um substituto.
2. Em produção o banco fica em memória: os dados de demonstração voltam ao estado inicial quando a hospedagem reinicia a API. Para um sistema real, o passo seguinte seria um banco gerenciado.
3. Chave de API em um site que roda no navegador não é segredo, porque qualquer pessoa consegue ler. Ela identifica o cliente autorizado; quem protege os dados é o token.
4. As cores são as da Central da Marca do CEUB (roxo escuro `#43054E`, roxo `#662C92`, lilás `#BF0087`, magenta `#EC0089` e amarelo `#FDE100`). O logotipo da instituição não é usado.
5. A arara e os modelos de camiseta, moletom e camisa vêm do componente Clothes Rack, de DiMaac UI. A página do componente não informa a licença, então o repositório traz só o pacote compilado, sem o código-fonte dele.

## Estrutura

```
backend/    API (Express), banco (SQLite) e testes (Vitest com Supertest)
frontend/   Site (React, Tailwind, Materialize), testes (Vitest, Testing Library) e Cypress
.github/    Pipeline do GitHub Actions
vercel.json Publicação: o site e a API como dois serviços do mesmo projeto
```

## Pipeline

A cada push ou pull request, o GitHub Actions roda os testes do back-end, os testes e o build do front-end, e depois o Cypress com a API e o site no ar. A cada push na `main`, a Vercel publica o site e a API em https://ciranda-web.vercel.app. Os segredos de produção (segredo do token e chave de API) ficam nas variáveis de ambiente da Vercel, fora do repositório.
