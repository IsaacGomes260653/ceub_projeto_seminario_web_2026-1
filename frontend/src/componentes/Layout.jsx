import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { MENU } from "../menu.js";
import { useSessao } from "../sessao.jsx";
import { Logo } from "./Logo.jsx";

export function Layout() {
  const { usuario, pode, sair } = useSessao();
  const [aberto, setAberto] = useState(false);
  const itens = MENU.filter((i) => pode(i.exige));
  const classe = ({ isActive }) => `item-menu ${isActive ? "ativo" : ""}`;

  return (
    <div className="min-h-screen flex flex-col">
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <header className="bg-ceub-escuro text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
          <NavLink to="/" aria-label="Ciranda, início" className="shrink-0"><Logo claro tamanho={28} /></NavLink>
          <button type="button" className="botao-menu md:hidden ml-auto" aria-expanded={aberto} aria-controls="menu-principal" onClick={() => setAberto((a) => !a)}>
            {aberto ? "Fechar menu" : "Menu"}
          </button>
          <nav id="menu-principal" aria-label="Principal" className={`${aberto ? "flex" : "hidden"} md:flex menu`}>
            <ul className="flex flex-col md:flex-row md:items-center gap-1 m-0 p-0 list-none">
              {itens.map((i) => (
                <li key={i.rota}><NavLink to={i.rota} className={classe} onClick={() => setAberto(false)}>{i.rotulo}</NavLink></li>
              ))}
            </ul>
            <div className="flex items-center gap-3 md:ml-auto pt-3 md:pt-0 border-t border-white/25 md:border-0">
              <span className="text-sm"><span className="sr-only">Conectado como </span>{usuario.nome.split(" ")[0]} · {usuario.perfil}</span>
              <button type="button" className="btn btn-small sair" onClick={() => sair()}>Sair</button>
            </div>
          </nav>
        </div>
      </header>
      <main id="conteudo" tabIndex="-1" className="mx-auto w-full max-w-6xl px-4 py-8 flex-1"><Outlet /></main>
      <footer className="border-t border-ceub-linha">
        <p className="mx-auto max-w-6xl px-4 py-5 m-0 text-sm text-ceub-cinza">Ciranda · projeto de Desenvolvimento Web, CEUB 2026. Sistema acadêmico, sem vendas reais.</p>
      </footer>
    </div>
  );
}
