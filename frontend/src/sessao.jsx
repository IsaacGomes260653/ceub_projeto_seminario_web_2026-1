import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, definirAoExpirar, sessaoGuardada } from "./api.js";

const Contexto = createContext(null);
export const useSessao = () => useContext(Contexto);

export function ProvedorDeSessao({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");

  const limpar = useCallback((mensagem = "") => {
    sessaoGuardada.gravar(null);
    setUsuario(null);
    setAviso(mensagem);
  }, []);

  // Sair encerra a sessão dos dois lados: apaga o cookie na API e o token nesta aba.
  const sair = useCallback((mensagem = "") => {
    api.sair().catch(() => {});
    limpar(mensagem);
  }, [limpar]);

  useEffect(() => {
    definirAoExpirar(() => limpar("Sua sessão expirou. Entre de novo."));
    // Com token na aba, confirma com o servidor antes de confiar nele.
    // Sem token (aba nova, por exemplo), tenta retomar a sessão pelo cookie HttpOnly.
    const retomar = sessaoGuardada.ler() ? api.eu() : api.renovar();
    retomar.then((r) => setUsuario(r.usuario)).catch(() => sessaoGuardada.gravar(null)).finally(() => setCarregando(false));
  }, [limpar]);

  const entrar = useCallback(async (email, senha) => {
    const r = await api.entrar(email, senha);
    sessaoGuardada.gravar(r.token);
    setAviso("");
    setUsuario(r.usuario);
    return r.usuario;
  }, []);

  const cadastrar = useCallback(async (dados) => {
    const r = await api.cadastrar(dados);
    sessaoGuardada.gravar(r.token);
    setAviso("");
    setUsuario(r.usuario);
    return r.usuario;
  }, []);

  const valor = useMemo(() => ({
    usuario, carregando, aviso, entrar, cadastrar, sair,
    pode: (chave) => Boolean(usuario && usuario.funcionalidades.includes(chave)),
  }), [usuario, carregando, aviso, entrar, cadastrar, sair]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
