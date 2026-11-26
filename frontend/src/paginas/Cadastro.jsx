import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Campo } from "../componentes/Campo.jsx";
import { Logo } from "../componentes/Logo.jsx";
import { useSessao } from "../sessao.jsx";

const CAMPOS = [
  { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, max: 80, auto: "name" },
  { nome: "email", rotulo: "E-mail", tipo: "email", obrigatorio: true, max: 120, auto: "email" },
  { nome: "senha", rotulo: "Senha", tipo: "senha", obrigatorio: true, auto: "new-password", ajuda: "Pelo menos 8 caracteres." },
];

// Cadastro aberto: toda conta nova entra como Cliente. Outros perfis só a administradora concede.
export function Cadastro() {
  const { usuario, cadastrar } = useSessao();
  const [valores, setValores] = useState({ nome: "", email: "", senha: "" });
  const [erros, setErros] = useState({});
  const [falha, setFalha] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { document.title = "Criar conta · Ciranda"; }, []);
  if (usuario) return <Navigate to="/" replace />;

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setErros({}); setFalha("");
    try { await cadastrar(valores); } catch (erro) {
      setErros(erro.detalhes || {}); setFalha(erro.message); setEnviando(false);
      const primeiro = Object.keys(erro.detalhes || {})[0];
      if (primeiro) setTimeout(() => document.getElementById(`cadastro-${primeiro}`)?.focus(), 0);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <section className="bg-ceub-escuro text-white p-8 md:p-14 flex flex-col justify-between gap-10">
        <Logo claro tamanho={34} />
        <div>
          <p className="font-titulo font-extrabold text-4xl md:text-5xl leading-none m-0" style={{ letterSpacing: "-0.035em" }}>Entre na roda.</p>
          <p className="mt-4 mb-0 max-w-md text-lg">Com uma conta você reserva peças, acompanha pedidos e pode vender as suas em consignação.</p>
        </div>
        <p className="m-0 text-sm opacity-90">CEUB · 2026</p>
      </section>
      <main className="p-8 md:p-14 flex items-center">
        <div className="w-full max-w-md mx-auto">
          <h1 className="titulo">Criar conta</h1>
          <form onSubmit={enviar} noValidate>
            {falha && <p className="erro-geral" role="alert">{falha}</p>}
            <div className="grid gap-4">
              {CAMPOS.map((c) => <Campo key={c.nome} campo={c} prefixo="cadastro" valor={valores[c.nome]} erro={erros[c.nome]} aoMudar={(v) => setValores((a) => ({ ...a, [c.nome]: v }))} />)}
            </div>
            <button type="submit" className="btn filled w-full mt-6" disabled={enviando}>{enviando ? "Criando…" : "Criar conta"}</button>
          </form>
          <p className="mt-6 mb-0">Já tem conta? <Link to="/entrar">Entrar</Link></p>
        </div>
      </main>
    </div>
  );
}
