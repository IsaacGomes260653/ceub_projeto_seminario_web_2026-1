// Camada única de acesso à API: chave de API, token e tratamento de erro ficam aqui.
const BASE = import.meta.env.VITE_API_URL || "/api";
const CHAVE = import.meta.env.VITE_API_KEY || "ciranda-dev-key";
const GUARDADO = "ciranda.token";

export class ErroDeApi extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes || {};
  }
}

// Dois níveis de sessão, cada um guardado onde é mais seguro:
// 1. JWT de acesso, curto, no sessionStorage. Vai no cabeçalho Authorization, some ao fechar a aba e o navegador
//    nunca o envia sozinho, então um site de fora não consegue usá-lo (sem CSRF).
// 2. Token de renovação, longo, em cookie HttpOnly gravado pela API. O JavaScript desta página não consegue ler,
//    então um script injetado (XSS) não leva a sessão. Ele só serve para pedir um JWT novo em /auth/renovar.
export const sessaoGuardada = {
  ler: () => { try { return sessionStorage.getItem(GUARDADO); } catch { return null; } },
  gravar: (token) => { try { token ? sessionStorage.setItem(GUARDADO, token) : sessionStorage.removeItem(GUARDADO); } catch { /* armazenamento indisponível */ } },
};

let aoExpirar = () => {};
export const definirAoExpirar = (fn) => { aoExpirar = fn; };

async function pedir(metodo, caminho, corpo) {
  const token = sessaoGuardada.ler();
  const cabecalhos = { "X-API-Key": CHAVE };
  if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  let resposta;
  try {
    resposta = await fetch(BASE + caminho, { method: metodo, headers: cabecalhos, credentials: "same-origin", body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  } catch {
    throw new ErroDeApi(0, "Não foi possível falar com o servidor. Confira sua conexão.");
  }
  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new ErroDeApi(resposta.status, dados.erro || "Algo deu errado.", dados.detalhes);
  return dados;
}

// Pede um JWT novo usando o cookie de sessão. Chamadas simultâneas dividem o mesmo pedido,
// porque o token do cookie é de uso único.
let renovando = null;
export function renovar() {
  renovando ||= pedir("POST", "/auth/renovar")
    .then((r) => { sessaoGuardada.gravar(r.token); return r; })
    .finally(() => { renovando = null; });
  return renovando;
}

export async function chamar(metodo, caminho, corpo) {
  try {
    return await pedir(metodo, caminho, corpo);
  } catch (erro) {
    // JWT vencido no meio do uso: tenta renovar pelo cookie e repete a chamada uma vez.
    // Se não der, limpa a sessão e manda para o login.
    if (erro.status !== 401 || !sessaoGuardada.ler() || caminho === "/auth/login") throw erro;
    try { await renovar(); } catch { aoExpirar(); throw erro; }
    return pedir(metodo, caminho, corpo);
  }
}

export const api = {
  listar: (recurso, filtros) => {
    const q = new URLSearchParams(Object.entries(filtros || {}).filter(([, v]) => v !== "" && v != null)).toString();
    return chamar("GET", recurso + (q ? `?${q}` : ""));
  },
  obter: (recurso, id) => chamar("GET", `${recurso}/${id}`),
  criar: (recurso, dados) => chamar("POST", recurso, dados),
  atualizar: (recurso, id, dados) => chamar("PUT", `${recurso}/${id}`, dados),
  remover: (recurso, id) => chamar("DELETE", `${recurso}/${id}`),
  acao: (caminho, dados = {}) => chamar("POST", caminho, dados),
  cadastrar: (dados) => chamar("POST", "/auth/cadastro", dados),
  entrar: (email, senha) => chamar("POST", "/auth/login", { email, senha }),
  eu: () => chamar("GET", "/auth/eu"),
  renovar,
  sair: () => pedir("POST", "/auth/sair"),
};
