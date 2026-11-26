// Um campo de formulário acessível: rótulo ligado ao controle, erro anunciado e descrito.
export function Campo({ campo, valor, erro, aoMudar, prefixo }) {
  const id = `${prefixo}-${campo.nome}`;
  const idErro = `${id}-erro`;
  const idAjuda = `${id}-ajuda`;
  const descrito = [erro ? idErro : null, campo.ajuda ? idAjuda : null].filter(Boolean).join(" ") || undefined;
  const comum = { id, name: campo.nome, required: campo.obrigatorio, "aria-invalid": erro ? "true" : undefined, "aria-describedby": descrito };
  const marca = campo.obrigatorio ? <span aria-hidden="true"> *</span> : null;

  if (campo.tipo === "grupo") {
    return (
      <fieldset className="grupo" aria-describedby={descrito}>
        <legend>{campo.rotulo}{marca}</legend>
        {campo.ajuda && <p id={idAjuda} className="ajuda">{campo.ajuda}</p>}
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          {campo.opcoes.map((o) => (
            <label key={o.valor} className="marcar">
              <input type="checkbox" className="filled-in" checked={valor.includes(o.valor)}
                onChange={(e) => aoMudar(e.target.checked ? [...valor, o.valor] : valor.filter((v) => v !== o.valor))} />
              <span><strong>{o.rotulo}</strong>{o.detalhe && <small> {o.detalhe}</small>}</span>
            </label>
          ))}
        </div>
        {erro && <p id={idErro} className="erro" role="alert">{erro}</p>}
      </fieldset>
    );
  }
  if (campo.tipo === "marcar") {
    return (
      <div className="campo">
        <label className="marcar">
          <input type="checkbox" className="filled-in" {...comum} required={false} checked={Boolean(valor)} onChange={(e) => aoMudar(e.target.checked)} />
          <span>{campo.rotulo}</span>
        </label>
        {campo.ajuda && <p id={idAjuda} className="ajuda">{campo.ajuda}</p>}
      </div>
    );
  }
  return (
    <div className="campo">
      <label htmlFor={id}>{campo.rotulo}{marca}</label>
      {campo.tipo === "escolha" ? (
        <select {...comum} className="browser-default" value={valor} onChange={(e) => aoMudar(e.target.value)}>
          <option value="">Escolha</option>
          {campo.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      ) : (
        <input {...comum} inputMode={campo.tipo === "numero" ? "decimal" : undefined} spellCheck={campo.tipo === "email" ? false : undefined}
          type={campo.tipo === "senha" ? "password" : campo.tipo === "numero" ? "number" : campo.tipo === "email" ? "email" : "text"}
          value={valor} step={campo.passo} min={campo.min} maxLength={campo.max} autoComplete={campo.auto || "off"} onChange={(e) => aoMudar(e.target.value)} />
      )}
      {campo.ajuda && <p id={idAjuda} className="ajuda">{campo.ajuda}</p>}
      {erro && <p id={idErro} className="erro" role="alert">{erro}</p>}
    </div>
  );
}
