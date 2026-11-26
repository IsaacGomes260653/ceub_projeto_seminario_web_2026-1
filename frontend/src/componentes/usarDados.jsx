import { useCallback, useEffect, useState } from "react";

// Carrega um dado da API e guarda os três estados que toda tela precisa mostrar: esperando, erro e pronto.
export function usarDados(buscar, dependencias = []) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const funcao = useCallback(buscar, dependencias);
  const carregar = useCallback(() => {
    setErro("");
    return funcao().then(setDados).catch((e) => setErro(e.message));
  }, [funcao]);
  useEffect(() => { carregar(); }, [carregar]);
  return { dados, erro, carregar, setDados };
}

// Bloco padrão para enquanto carrega ou quando a busca falha.
export function Espera({ erro, aoTentar }) {
  return erro
    ? <p className="erro-geral" role="alert">{erro} <button type="button" className="btn-flat" onClick={aoTentar}>Tentar de novo</button></p>
    : <p role="status">Carregando…</p>;
}
