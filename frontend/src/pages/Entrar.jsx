import { useState } from "react";
import { ROLES, MOCK_USUARIOS, entrar, salir, useSesion } from "../data/sesion.js";

export default function Entrar() {
  const sesion = useSesion();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");

  const enviar = (u = usuario, c = clave) => {
    const s = entrar(u, c);
    if (!s) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }
    setError("");
    window.location.hash = `#${ROLES[s.rol].ruta}`;
  };

  return (
    <main className="rg-app rg-app--phone">
      <div className="rg-demo-note">Modo demo: el acceso es simulado. El acceso real lo dará la API.</div>
      <div className="rg-phone">
        {sesion ? (
          <>
            <p className="rg-eyebrow">Sesión abierta</p>
            <h1>Hola, {ROLES[sesion.rol].nombre.toLowerCase()}</h1>
            <a className="rg-pill rg-pill--primary rg-full rg-tap" href={`#${ROLES[sesion.rol].ruta}`}>
              Ir a mi pantalla
            </a>
            <button type="button" className="rg-pill rg-pill--blue rg-full rg-tap" onClick={salir}>Salir</button>
          </>
        ) : (
          <>
            <p className="rg-eyebrow">Escuela piloto</p>
            <h1>Entrar</h1>
            <form className="rg-login" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
              <div className="rg-field">
                <label htmlFor="rg-usuario">Usuario</label>
                <input id="rg-usuario" className="rg-input" autoComplete="username" autoCapitalize="none"
                  value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
              </div>
              <div className="rg-field">
                <label htmlFor="rg-clave">Contraseña</label>
                <input id="rg-clave" className="rg-input" type="password" autoComplete="current-password"
                  value={clave} onChange={(e) => setClave(e.target.value)} required />
              </div>
              <div aria-live="polite">{error && <p className="rg-warn" role="alert">{error}</p>}</div>
              <button type="submit" className="rg-pill rg-pill--primary rg-full rg-tap">Entrar</button>
            </form>

            <div className="rg-login__demo rg-surface-mint">
              <p><strong>Usuarios de la demo</strong> (usuario = contraseña)</p>
              {MOCK_USUARIOS.map((u) => (
                <button key={u.usuario} type="button" className="rg-pill rg-pill--white rg-full rg-tap"
                  onClick={() => enviar(u.usuario, u.clave)}>
                  {u.etiqueta ?? ROLES[u.rol].nombre} · <b>{u.usuario}</b>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
