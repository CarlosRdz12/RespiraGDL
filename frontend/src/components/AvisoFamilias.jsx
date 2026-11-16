import { useEffect, useRef, useState } from "react";
import { HORA_PREDETERMINADA, MAX_CARACTERES, mensajePredeterminado } from "../data/avisos.js";
import { apiAvisos, useEnvioAviso } from "../data/useAvisos.js";

// Respaldo sin API (GitHub Pages): se guarda en este navegador, si lo permite.
const leer = (clave, defecto) => {
  try { return localStorage.getItem(clave) ?? defecto; } catch { return defecto; }
};
const guardar = (clave, valor) => {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: no pasa nada */ }
};

// Tarjeta pequeña con el resumen del aviso. Al hacer clic se abre una ventana modal para
// editar el mensaje y enviarlo en el momento, y para programar el aviso diario (hora y nota).
// `datos` = { escuela, semaforo, pm25, familias } (sale del pronóstico de mañana).
// `modo` = "cargando" | "api" | "local" (de useConexionApi en Tablero.jsx).
//
// Con la API (PR #38):
//   "Enviar ahora" -> POST /alertas/enviar {mensaje}; el bot lo reparte y lo marca enviado.
//   Hora y nota    -> GET/PUT /alertas/programacion. La nota es `mensaje` en la API: el bot la
//                     agrega debajo del pronóstico de cada mañana (no reemplaza el pronóstico).
export default function AvisoFamilias({ datos, modo }) {
  // Borrador del mensaje para enviar ahora: solo en este navegador.
  const [mensaje, setMensaje] = useState(() => leer("rg-aviso-mensaje", mensajePredeterminado(datos)));

  // Programación del aviso diario. `prog` dice de dónde sale: "cargando" | "api" | "local".
  const [prog, setProg] = useState("cargando");
  const [hora, setHora] = useState(HORA_PREDETERMINADA);
  const [horaGuardada, setHoraGuardada] = useState(HORA_PREDETERMINADA);
  const [nota, setNota] = useState("");
  const [notaGuardada, setNotaGuardada] = useState("");
  const [guardando, setGuardando] = useState(null); // null | "hora" | "nota"
  const [resultado, setResultado] = useState(null); // {ok, texto} del último guardado

  const { envio, enviar, reiniciar } = useEnvioAviso(apiAvisos, modo);
  const dialogo = useRef(null);

  useEffect(() => {
    if (modo === "cargando") return undefined;
    const usarLocal = () => {
      const h = leer("rg-aviso-hora", HORA_PREDETERMINADA);
      const n = leer("rg-aviso-nota", "");
      setHora(h); setHoraGuardada(h); setNota(n); setNotaGuardada(n);
      setProg("local");
    };
    if (modo !== "api") { usarLocal(); return undefined; }
    let vivo = true;
    apiAvisos.leerProgramacion()
      .then((p) => {
        if (!vivo) return;
        setHora(p.hora); setHoraGuardada(p.hora);
        setNota(p.nota ?? ""); setNotaGuardada(p.nota ?? "");
        setProg("api");
      })
      .catch(() => { if (vivo) usarLocal(); }); // API sin /alertas/programacion: respaldo local
    return () => { vivo = false; };
  }, [modo]);

  const abrir = () => dialogo.current?.showModal();
  const cerrar = () => dialogo.current?.close();
  // Clic en el fondo oscuro (fuera de la ventana) también cierra.
  const clicFondo = (e) => { if (e.target === dialogo.current) cerrar(); };

  const terminado = ["enviado", "error", "sin-confirmar"].includes(envio.estado);
  const editar = (texto) => {
    setMensaje(texto);
    guardar("rg-aviso-mensaje", texto);
    if (terminado) reiniciar();
  };
  const usarPredeterminado = () => editar(mensajePredeterminado(datos));

  // El PUT reemplaza hora y nota juntas: se leen las de la API justo antes para no pisar un cambio
  // hecho desde otro lado (p. ej. /hora en el bot).
  const guardarProgramacion = async (que) => {
    const nuevaHora = que === "hora" ? hora : horaGuardada;
    const nuevaNota = que === "nota" ? nota.trim() : notaGuardada;
    setResultado(null);
    if (prog !== "api") {
      guardar("rg-aviso-hora", nuevaHora);
      guardar("rg-aviso-nota", nuevaNota);
      setHoraGuardada(nuevaHora); setNotaGuardada(nuevaNota);
      if (que === "nota") setNota(nuevaNota);
      setResultado({ ok: true, texto: "Guardado en este navegador (simulado)." });
      return;
    }
    setGuardando(que);
    try {
      const actual = await apiAvisos.leerProgramacion();
      const p = await apiAvisos.guardarProgramacion(que === "hora"
        ? { hora: nuevaHora, nota: actual.nota }
        : { hora: actual.hora, nota: nuevaNota });
      const notaApi = p.nota ?? "";
      if (que === "hora") {
        // Si la nota no se estaba editando, se muestra la que tiene la API.
        setNota((n) => (n.trim() === notaGuardada.trim() ? notaApi : n));
      } else {
        setNota(notaApi);
        setHora((h) => (h === horaGuardada ? p.hora : h));
      }
      setHoraGuardada(p.hora); setNotaGuardada(notaApi);
      setResultado({ ok: true, texto: que === "hora" ? "Hora guardada. El bot la usa en menos de un minuto." : notaApi ? "Nota guardada." : "Nota quitada." });
    } catch {
      setResultado({ ok: false, texto: "No se pudo guardar. Revise la conexión e intente de nuevo." });
    } finally {
      setGuardando(null);
    }
  };

  const vacio = mensaje.trim() === "";
  const ocupado = envio.estado === "enviando" || envio.estado === "en-cola";
  const cargando = prog === "cargando";
  const notaSinCambios = nota.trim() === notaGuardada.trim();

  return (
    <>
      <button type="button" className="rg-panel rg-surface-sky rg-aviso-mini" onClick={abrir} aria-haspopup="dialog">
        <span className="rg-panel__title">Aviso a familias</span>
        <span className="rg-aviso-mini__prev">{vacio ? "Sin mensaje" : mensaje.replace(/\s+/g, " ")}</span>
        <span className="rg-muted">
          {cargando ? "Cargando programación…" : `Programado: todos los días a las ${horaGuardada}`}
          {envio.estado === "enviado" && ` · último envío ${envio.hora}`}
        </span>
        <span className="rg-aviso-mini__cta">Editar, programar o enviar ahora →</span>
      </button>

      <dialog ref={dialogo} className="rg-modal" aria-labelledby="rg-aviso-titulo" onClick={clicFondo}>
        <div className="rg-modal__body rg-aviso">
          <div className="rg-modal__head">
            <h2 id="rg-aviso-titulo">Aviso a familias</h2>
            <button type="button" className="rg-modal__close" onClick={cerrar} aria-label="Cerrar">×</button>
          </div>

          <div className="rg-field">
            <div className="rg-field__head">
              <label htmlFor="rg-aviso-texto">Mensaje para enviar ahora</label>
              <button type="button" className="rg-pill rg-pill--blue rg-tap" onClick={usarPredeterminado}>
                Usar mensaje predeterminado
              </button>
            </div>
            <textarea id="rg-aviso-texto" className="rg-textarea" rows={10} maxLength={MAX_CARACTERES}
              value={mensaje} onChange={(e) => editar(e.target.value)} />
            <p className="rg-muted rg-field__foot">
              <span>El predeterminado se arma con el semáforo y el PM2.5 de mañana. No escribas nombres de alumnos.</span>
              <span>{mensaje.length}/{MAX_CARACTERES}</span>
            </p>
          </div>

          <button type="button" className="rg-pill rg-pill--primary rg-full rg-tap"
            onClick={() => enviar(mensaje)} disabled={vacio || ocupado || modo === "cargando"}>
            {ocupado ? "Enviando…" : "Enviar ahora"}
          </button>
          <div aria-live="polite">
            <EstadoEnvio envio={envio} familiasDemo={datos.familias} />
          </div>

          <div className="rg-field">
            <label htmlFor="rg-aviso-hora">Aviso diario automático</label>
            <div className="rg-field__row">
              <span>Todos los días a las</span>
              <input id="rg-aviso-hora" type="time" className="rg-time" value={hora}
                onChange={(e) => setHora(e.target.value)} disabled={cargando} />
              <button type="button" className="rg-pill rg-pill--blue rg-tap" onClick={() => guardarProgramacion("hora")}
                disabled={!hora || hora === horaGuardada || guardando !== null || cargando}>
                {guardando === "hora" ? "Guardando…" : "Guardar hora"}
              </button>
            </div>
            <p className="rg-muted">
              El bot manda el semáforo y el PM2.5 de mañana. Solo sale si hay pronóstico real.
            </p>
          </div>

          <div className="rg-field">
            <label htmlFor="rg-aviso-nota">Nota de la escuela para el aviso diario (opcional)</label>
            <textarea id="rg-aviso-nota" className="rg-textarea rg-textarea--nota" rows={3} maxLength={MAX_CARACTERES}
              value={nota} onChange={(e) => setNota(e.target.value)} disabled={cargando}
              placeholder="Ej.: Mañana hay junta de padres a las 8:00." />
            <p className="rg-muted rg-field__foot">
              <span>Va debajo del pronóstico, todos los días, hasta que la quites. No escribas nombres de alumnos.</span>
              <span>{nota.length}/{MAX_CARACTERES}</span>
            </p>
            <button type="button" className="rg-pill rg-pill--blue rg-tap rg-aviso__guardar"
              onClick={() => guardarProgramacion("nota")} disabled={notaSinCambios || guardando !== null || cargando}>
              {guardando === "nota" ? "Guardando…" : nota.trim() === "" && notaGuardada ? "Quitar nota" : "Guardar nota"}
            </button>
          </div>

          <div aria-live="polite">
            {!cargando && (
              <p className="rg-muted">
                Programado: todos los días a las {horaGuardada}, {notaGuardada ? "con nota" : "sin nota"}
                {prog === "local" && " (simulado: se guarda solo en este navegador)"}.
              </p>
            )}
            {resultado && (
              <p className={resultado.ok ? "rg-sent" : "rg-aviso__error"} role={resultado.ok ? undefined : "alert"}>
                {resultado.texto}
              </p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

// Texto del estado del envío inmediato. También lo usa la tarjeta de pronóstico de Tablero.jsx.
export function EstadoEnvio({ envio, familiasDemo, icono = null }) {
  switch (envio.estado) {
    case "en-cola":
      return <p className="rg-muted">Aviso recibido. El bot de Telegram lo está repartiendo…</p>;
    case "enviado":
      return envio.simulado ? (
        <p className="rg-sent">{icono}Aviso enviado ahora ({envio.hora}) a {familiasDemo} familias por Telegram (simulado).</p>
      ) : (
        <p className="rg-sent">{icono}Aviso enviado a las {envio.hora} a {envio.familias} familias por Telegram.</p>
      );
    case "sin-confirmar":
      return (
        <p className="rg-aviso__error" role="alert">
          El aviso quedó guardado, pero el bot todavía no lo reparte. Revise que el bot esté encendido.
        </p>
      );
    case "error":
      return (
        <p className="rg-aviso__error" role="alert">
          No se pudo enviar el aviso. Revise la conexión e intente de nuevo.
        </p>
      );
    default:
      return null;
  }
}
