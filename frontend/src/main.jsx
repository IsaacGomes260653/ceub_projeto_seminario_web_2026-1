import "@materializecss/materialize/dist/css/materialize.min.css";
import "./estilo.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.jsx";
import { ProvedorDeSessao } from "./sessao.jsx";

createRoot(document.getElementById("raiz")).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ProvedorDeSessao><App /></ProvedorDeSessao>
    </BrowserRouter>
  </React.StrictMode>,
);
