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

// O token fica no sessionStorage: some ao fechar a aba e não é enviado sozinho pelo navegador.
export const sessaoGuardada = {
  ler: () => { try { return sessionStorage.getItem(GUARDADO); } catch { return null; } },
  gravar: (token) => { try { token ? sessionStorage.setItem(GUARDADO, token) : sessionStorage.removeItem(GUARDADO); } catch { /* armazenamento indisponível */ } },
};

let aoExpirar = () => {};
export const definirAoExpirar = (fn) => { aoExpirar = fn; };

export async function chamar(metodo, caminho, corpo) {
  const token = sessaoGuardada.ler();
  const cabecalhos = { "X-API-Key": CHAVE };
  if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  let resposta;
  try {
    resposta = await fetch(BASE + caminho, { method: metodo, headers: cabecalhos, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  } catch {
    throw new ErroDeApi(0, "Não foi possível falar com o servidor. Confira sua conexão.");
  }
  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    // Sessão vencida no meio do uso: limpa e manda para o login.
    if (resposta.status === 401 && token && caminho !== "/auth/login") aoExpirar();
    throw new ErroDeApi(resposta.status, dados.erro || "Algo deu errado.", dados.detalhes);
  }
  return dados;
}

export const api = {
  listar: (recurso, filtros) => {
    const q = new URLSearchParams(Object.entries(filtros || {}).filter(([, v]) => v !== "" && v != null)).toString();
    return chamar("GET", recurso + (q ? `?${q}` : ""));
  },
  criar: (recurso, dados) => chamar("POST", recurso, dados),
  atualizar: (recurso, id, dados) => chamar("PUT", `${recurso}/${id}`, dados),
  remover: (recurso, id) => chamar("DELETE", `${recurso}/${id}`),
  entrar: (email, senha) => chamar("POST", "/auth/login", { email, senha }),
  eu: () => chamar("GET", "/auth/eu"),
};
