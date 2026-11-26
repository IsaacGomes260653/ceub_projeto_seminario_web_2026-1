import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./componentes/Layout.jsx";
import { MENU } from "./menu.js";
import { Funcionalidades, Pecas, Perfis, Usuarios } from "./paginas/Cadastros.jsx";
import { Catalogo } from "./paginas/Catalogo.jsx";
import { Login } from "./paginas/Login.jsx";
import { Peca } from "./paginas/Peca.jsx";
import { useSessao } from "./sessao.jsx";

const TELAS = { "/catalogo": Catalogo, "/pecas": Pecas, "/usuarios": Usuarios, "/perfis": Perfis, "/funcionalidades": Funcionalidades };

// Só entra quem está logado. A tela some do menu e a rota fica fechada para quem não tem a funcionalidade.
// O servidor confere de novo em cada requisição: esconder no front é conforto, não segurança.
function Protegida({ exige, children }) {
  const { usuario, pode } = useSessao();
  if (!usuario) return <Navigate to="/entrar" replace />;
  if (exige && !pode(exige)) {
    return (
      <section aria-labelledby="sem-acesso">
        <h1 id="sem-acesso" className="titulo">Sem acesso</h1>
        <p>Seu perfil não tem esta funcionalidade. Fale com a administradora se precisar dela.</p>
      </section>
    );
  }
  return children;
}

function Inicio() {
  const { pode } = useSessao();
  const primeira = MENU.find((i) => pode(i.exige));
  return primeira ? <Navigate to={primeira.rota} replace /> : <p>Seu perfil ainda não tem nenhuma funcionalidade liberada.</p>;
}

export function App() {
  const { carregando } = useSessao();
  if (carregando) return <p className="p-8" role="status">Carregando…</p>;
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route element={<Protegida><Layout /></Protegida>}>
        <Route index element={<Inicio />} />
        {MENU.map(({ rota, exige }) => {
          const Tela = TELAS[rota];
          return <Route key={rota} path={rota} element={<Protegida exige={exige}><Tela /></Protegida>} />;
        })}
        <Route path="/catalogo/:id" element={<Protegida exige="catalogo.ver"><Peca /></Protegida>} />
        <Route path="*" element={<section><h1 className="titulo">Página não encontrada</h1><p>O endereço não existe. Use o menu para voltar.</p></section>} />
      </Route>
    </Routes>
  );
}
