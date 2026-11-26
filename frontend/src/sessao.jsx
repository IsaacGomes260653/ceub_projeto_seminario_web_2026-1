import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, definirAoExpirar, sessaoGuardada } from "./api.js";

const Contexto = createContext(null);
export const useSessao = () => useContext(Contexto);

export function ProvedorDeSessao({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(sessaoGuardada.ler()));
  const [aviso, setAviso] = useState("");

  const sair = useCallback((mensagem = "") => {
    sessaoGuardada.gravar(null);
    setUsuario(null);
    setAviso(mensagem);
  }, []);

  useEffect(() => {
    definirAoExpirar(() => sair("Sua sessão expirou. Entre de novo."));
    if (!sessaoGuardada.ler()) return;
    // Ao recarregar a página, confirma o token com o servidor antes de confiar nele.
    api.eu().then((r) => setUsuario(r.usuario)).catch(() => sessaoGuardada.gravar(null)).finally(() => setCarregando(false));
  }, [sair]);

  const entrar = useCallback(async (email, senha) => {
    const r = await api.entrar(email, senha);
    sessaoGuardada.gravar(r.token);
    setAviso("");
    setUsuario(r.usuario);
    return r.usuario;
  }, []);

  const valor = useMemo(() => ({
    usuario, carregando, aviso, entrar, sair,
    pode: (chave) => Boolean(usuario && usuario.funcionalidades.includes(chave)),
  }), [usuario, carregando, aviso, entrar, sair]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
