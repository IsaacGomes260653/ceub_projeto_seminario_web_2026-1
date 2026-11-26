import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Logo } from "../componentes/Logo.jsx";
import { useSessao } from "../sessao.jsx";

const DEMOS = [
  ["lucia@ciranda.app", "Administradora", "gerencia usuários, perfis e funcionalidades"],
  ["beatriz@ciranda.app", "Fornecedor", "cadastra e mantém peças"],
  ["ana@ciranda.app", "Cliente", "navega pelo catálogo"],
];

export function Login() {
  const { usuario, entrar, aviso } = useSessao();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  if (usuario) return <Navigate to="/" replace />;

  async function enviar(e) {
    e.preventDefault();
    setErro(""); setEnviando(true);
    try { await entrar(email, senha); } catch (falha) { setErro(falha.message); setEnviando(false); }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <section className="bg-ceub-escuro text-white p-8 md:p-14 flex flex-col justify-between gap-10">
        <Logo claro tamanho={34} />
        <div>
          <h1 className="font-titulo font-extrabold text-4xl md:text-5xl leading-none m-0" style={{ letterSpacing: "-0.035em" }}>Roupa boa não acaba. Ela dá voltas.</h1>
          <p className="mt-4 mb-0 max-w-md text-lg">Brechó online do projeto de Desenvolvimento Web. Cada perfil enxerga só o que pode fazer.</p>
        </div>
        <p className="m-0 text-sm opacity-90">CEUB · 2026</p>
      </section>
      <main className="p-8 md:p-14 flex items-center">
        <div className="w-full max-w-md mx-auto">
          <h2 className="titulo">Entrar</h2>
          {aviso && <p className="aviso" role="status">{aviso}</p>}
          <form onSubmit={enviar} noValidate>
            <div className="campo">
              <label htmlFor="login-email">E-mail</label>
              <input id="login-email" name="email" type="email" inputMode="email" spellCheck={false} autoCapitalize="none" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={erro ? "login-erro" : undefined} />
            </div>
            <div className="campo mt-4">
              <label htmlFor="login-senha">Senha</label>
              <input id="login-senha" name="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} aria-describedby={erro ? "login-erro" : undefined} />
            </div>
            {erro && <p id="login-erro" className="erro-geral mt-4" role="alert">{erro}</p>}
            <button type="submit" className="btn filled w-full mt-6" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
          </form>
          <h3 className="subtitulo" style={{ marginTop: "2.5rem" }}>Contas de demonstração</h3>
          <p className="ajuda">Senha de todas: ciranda123. Toque em uma para preencher.</p>
          <ul className="list-none p-0 m-0">
            {DEMOS.map(([e, perfil, oQue]) => (
              <li key={e}>
                <button type="button" className="demo" onClick={() => { setEmail(e); setSenha("ciranda123"); setErro(""); }}>
                  <strong>{perfil}</strong><span>{e}, {oQue}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
