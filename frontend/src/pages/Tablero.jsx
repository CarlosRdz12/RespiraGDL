import { useEffect, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import {
  SEMAFORO, NORMA_PM25, PROTECCION_MINIMA, PROTECCION_BUENA, nivelPm25,
} from "../data/demo.js";
import AvisoFamilias, { EstadoEnvio } from "../components/AvisoFamilias.jsx";
import NotaDatos from "../components/NotaDatos.jsx";
import { apiAvisos, useConexionApi, useEnvioAviso } from "../data/useAvisos.js";
import { useTableroDatos } from "../data/useDatos.js";
import { usePlanes } from "../data/planes.js";
import { salir } from "../data/sesion.js";

// Nivel de PM2.5 -> color del semáforo de la escuela, igual que backend/app/core/semaforo.py:
// Buena o Aceptable = verde, Mala = amarillo, Muy mala o peor = rojo.
const COLOR_POR_NIVEL = { good: "verde", ok: "verde", bad: "amarillo", vbad: "rojo", ext: "rojo" };

// Semáforo ({id, nombre} de SEMAFORO) para un color de la API o, si no llega, para un PM2.5.
// Lo usan la píldora y el fondo de las tarjetas de Aula Limpia, para que nunca digan colores distintos.
export function semaforoDe({ color, pm }) {
  const c = color ?? (pm != null ? COLOR_POR_NIVEL[nivelPm25(pm)?.id] : undefined);
  return SEMAFORO[c] ?? SEMAFORO.amarillo;
}

// Píldora del semáforo. `color` es lo que manda la API: "verde" | "amarillo" | "rojo".
// Si no llega color (p. ej. Aula Limpia solo pasa `pm`), se calcula con el PM2.5.
export function Semaforo({ color, pm, big, prefijo }) {
  const s = semaforoDe({ color, pm });
  return (
    <span className={`rg-aq rg-aq--${s.id}${big ? " rg-aq--big" : ""}`}>
      <i aria-hidden="true" />
      {prefijo}{s.nombre}{pm != null && ` · PM2.5 ${pm}`}
    </span>
  );
}

// Íconos de línea (estilo Lucide, trazo 1.5) en SVG inline para no sumar dependencias.
const Icono = ({ children, className = "rg-ico" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const IconoAviso = () => (
  <Icono><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></Icono>
);
const IconoPulmones = () => (
  <Icono>
    <path d="M12 3v9M12 12c-1 1.5-3 2-4 2" /><path d="M12 12c1 1.5 3 2 4 2" />
    <path d="M8 7C5 7 3 12 3 17c0 2 1 3 3 3s3-1.5 3-3V9c0-1-.4-2-1-2z" />
    <path d="M16 7c3 0 5 5 5 10 0 2-1 3-3 3s-3-1.5-3-3V9c0-1 .4-2 1-2z" />
  </Icono>
);
const IconoCheck = () => <Icono><path d="M20 6 9 17l-5-5" /></Icono>;

// Lee un token de tokens.css para pasárselo a Recharts (que pide colores como props).
function useToken(name, fallback) {
  const [v, setV] = useState(fallback);
  useEffect(() => {
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (val) setV(val);
  }, [name]);
  return v;
}

function TooltipLecturas({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rg-tip">
      <strong>{label}</strong>
      {payload.map((p) => (
        <span key={p.dataKey}><i style={{ background: p.stroke }} />{p.name}: {p.value} µg/m³</span>
      ))}
    </div>
  );
}

// Etiqueta directa al final de cada línea (para no depender solo del color).
const etiquetaFinal = (texto, color, total) => ({ x, y, index }) =>
  index === total - 1 ? (
    <text x={x + 8} y={y + 4} fill={color} className="rg-chart__end">{texto}</text>
  ) : null;

function GraficaLecturas({ data, grupo }) {
  const fuera = useToken("--rg-aq-bad", "#b23c0a");
  const dentro = useToken("--rg-teal", "#0b585b");
  const grid = useToken("--rg-sage", "#ceddd1");
  const muted = useToken("--rg-muted", "#59735f");
  const tick = { fill: muted, fontSize: 11, fontFamily: "var(--rg-font)" };
  // La guía pide respetar prefers-reduced-motion: Recharts anima por JS, así que se apaga aquí.
  const animar = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="rg-rchart" role="img" aria-label={`PM2.5 fuera y dentro del salón ${grupo} de 7:00 a 16:00`}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 16, right: 56, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={grid} strokeOpacity={0.6} vertical={false} />
          <XAxis dataKey="h" tick={tick} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 80]} ticks={[0, 20, 40, 60, 80]} tick={tick} tickLine={false} axisLine={false} />
          <ReferenceLine y={NORMA_PM25} stroke={muted} strokeDasharray="5 6"
            label={{ value: `norma ${NORMA_PM25}`, position: "insideTopRight", fill: muted, fontSize: 11 }} />
          <Tooltip content={<TooltipLecturas />} cursor={{ stroke: muted, strokeWidth: 1 }} />
          <Line type="monotone" dataKey="fuera" name="Fuera" stroke={fuera} strokeWidth={2.5}
            dot={false} activeDot={{ r: 5 }} isAnimationActive={animar} label={etiquetaFinal("Fuera", fuera, data.length)} />
          <Line type="monotone" dataKey="dentro" name="Dentro del salón" stroke={dentro} strokeWidth={2.5}
            dot={false} activeDot={{ r: 5 }} isAnimationActive={animar} label={etiquetaFinal("Dentro", dentro, data.length)} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Número de PM2.5 coloreado por nivel, siempre con la palabra (nunca color solo).
// Sin dato (el sensor no mandó lecturas en la última hora) se muestra una raya, no "Buena".
function Pm({ valor }) {
  if (valor == null) return <span className="rg-muted" title="Sin lecturas recientes">—</span>;
  const n = nivelPm25(valor);
  return (
    <span className={`rg-pm rg-pm--${n.id}`}>
      <strong>{valor}</strong>
      <small>{n.nombre}</small>
    </span>
  );
}

export default function Tablero() {
  // Planes de acción: el director solo ve cuántos hay por salón, nunca el detalle.
  const planes = usePlanes();
  const conPlan = (id) => planes.filter((p) => p.salonId === id).length;

  // Estado de la interfaz (no es mock): salón elegido en la tabla.
  const [seleccionado, setSeleccionado] = useState("3A");

  // Con API: escuela (/escuelas/miravalle), salones (/salones), pronóstico (/pronostico/manana) y la
  // serie del salón elegido (/lecturas/serie?salon_id=…), cada minuto. Sin API: datos simulados de demo.js.
  const modoApi = useConexionApi(apiAvisos);
  const { escuela, salones, pronostico, lecturas, origen } = useTableroDatos(modoApi, seleccionado);

  // Aviso a familias con la API (POST /alertas/enviar; el bot lo reparte). Sin API, se simula.
  const { envio, enviar } = useEnvioAviso(apiAvisos, modoApi);
  // Sin mensaje: la API usa su texto sugerido según el pronóstico de mañana.
  const enviarAviso = () => enviar();

  // Derivados de los datos (se calculan de lo que mande /salones). Sin dato de protección no hay alerta.
  const alertas = salones.filter((s) => s.proteccion != null && s.proteccion < PROTECCION_MINIMA);
  const salon = salones.find((s) => s.id === seleccionado) ?? salones[0];
  const serie = lecturas[salon?.id] ?? [];
  const sem = SEMAFORO[pronostico.semaforo] ?? SEMAFORO.amarillo;
  // La API avisa que un pronóstico desactualizado no debe mandarse a las familias.
  const desactualizado = Boolean(pronostico.desactualizado);

  return (
    <main className="rg-app">
      <NotaDatos origen={origen} />

      <header className="rg-dir">
        <div className="rg-dir__brand">
          <span className="rg-dir__logo">Respira <b>GDL</b></span>
          <span className="rg-dir__tag">{escuela.nombreCorto}</span>
        </div>
        <div className="rg-dir__right">
          <span className="rg-muted">Vista del director · {escuela.momento}</span>
          <a className="rg-pill rg-tap" href="#/aula">Ver Aula Limpia</a>
          <button type="button" className="rg-pill rg-pill--blue rg-tap" onClick={salir}>Salir</button>
        </div>
        <div className={`rg-dir__today rg-aq-bg--${SEMAFORO[escuela.semaforoHoy]?.id}`}>
          <small>Semáforo de hoy</small>
          {escuela.semaforoHoy || escuela.pm25Hoy != null
            ? <Semaforo color={escuela.semaforoHoy} pm={escuela.pm25Hoy} big />
            : <strong>Sin dato de hoy</strong>}
          <span className="rg-muted">PM2.5 fuera en µg/m³ · {escuela.estacion} · {escuela.actualizado}</span>
        </div>
      </header>

      <div className="rg-dash">
        <section className="rg-panel rg-surface-lilac">
          <h2 className="rg-panel__title">Salones · PM2.5 fuera / dentro y protección</h2>
          <div className="rg-table-wrap">
            <table className="rg-table rg-table--salones">
              <thead>
                <tr><th>Grupo</th><th>Protección</th><th>Fuera</th><th>Dentro</th><th>%</th><th>Asma</th><th>Con plan</th></tr>
              </thead>
              <tbody>
                {salones.map((s) => {
                  const activo = s.id === salon?.id;
                  const nivelBarra = (s.proteccion ?? 0) >= PROTECCION_BUENA ? "good" : "ok";
                  return (
                    <tr key={s.id} className={activo ? "is-selected" : ""} aria-selected={activo}
                      onClick={() => setSeleccionado(s.id)}>
                      <td>
                        <button type="button" className="rg-row-btn" aria-pressed={activo}
                          aria-label={`Ver gráfica de ${s.grupo}`}>{s.grupo}</button>
                      </td>
                      <td>
                        <div className={`rg-bar rg-bar--${nivelBarra}`}>
                          <span style={{ width: `${Math.max(s.proteccion ?? 0, 0)}%` }} />
                        </div>
                      </td>
                      <td>{s.fuera ?? "—"}</td>
                      <td><Pm valor={s.dentro} /></td>
                      <td>{s.proteccion != null ? `${s.proteccion} %` : "—"}</td>
                      <td>
                        <span className="rg-asma" title="Alumnos con asma (solo el número)">
                          <IconoPulmones />{s.asma}
                        </span>
                      </td>
                      <td title="Planes de acción que llenaron las familias (solo el número)">{conPlan(s.id)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="rg-muted">
            Toca un grupo para ver su gráfica. PM2.5 en µg/m³. "Con plan": planes de asma que llenaron las familias.
          </p>

          {alertas.map((s) => (
            <p key={s.id} className="rg-warn" role="alert">
              <IconoAviso />
              {s.filtro === false ? (
                <span><strong>{s.grupo}: sin filtro todavía (protección {s.proteccion} %).</strong>{" "}
                  Prioridad para instalar uno.</span>
              ) : (
                <span><strong>{s.grupo}: protección baja ({s.proteccion} %).</strong>{" "}
                  Revisar que el filtro esté encendido y la puerta cerrada.</span>
              )}
            </p>
          ))}
        </section>

        <div className="rg-dash__col">
          <section className="rg-panel rg-surface-mist">
            <div className="rg-panel__head">
              <h2 className="rg-panel__title">Hoy en {salon?.grupo} · PM2.5 <span className="rg-unit">(µg/m³)</span></h2>
              <div className="rg-legend">
                <span><i className="is-fuera" />Fuera</span>
                <span><i className="is-dentro" />Dentro del salón</span>
                <span><i className="is-norma" />Norma {NORMA_PM25}</span>
              </div>
            </div>
            <GraficaLecturas data={serie} grupo={salon?.grupo} />
          </section>

          <section className={`rg-panel rg-aq-bg--${sem.id}`}>
            <p className="rg-panel__title rg-eyebrow">Pronóstico de {pronostico.dia.toLowerCase()}</p>
            <p className={`rg-forecast rg-forecast--${sem.id}`}>{sem.nombre} · PM2.5 {pronostico.pm25 ?? "—"}</p>
            <p>
              <strong>Recomendación:</strong> {String(pronostico.recomendacion ?? "").replace(/\.\s*$/, "")}; avisar a {pronostico.familiasAviso} familias
              de alumnos con asma.
            </p>
            {desactualizado && (
              <p className="rg-muted">El pronóstico está desactualizado: no se recomienda avisar a las familias.</p>
            )}
            {!desactualizado && pronostico.simulado && (
              <p className="rg-muted">Pronóstico hecho con lecturas simuladas.</p>
            )}
            <button type="button" className="rg-pill rg-pill--primary rg-full rg-tap"
              onClick={enviarAviso}
              disabled={desactualizado || modoApi === "cargando" || !["listo", "error"].includes(envio.estado)}>
              {["enviando", "en-cola"].includes(envio.estado) ? "Enviando…"
                : envio.estado === "enviado" ? "Aviso enviado"
                  : envio.estado === "error" ? "Reintentar envío" : "Enviar aviso a familias"}
            </button>
            <div aria-live="polite">
              <EstadoEnvio envio={envio} familiasDemo={pronostico.familiasAviso} icono={<IconoCheck />} />
            </div>
          </section>

          <AvisoFamilias modo={modoApi} datos={{
            escuela: escuela.nombre, semaforo: pronostico.semaforo,
            pm25: pronostico.pm25, familias: pronostico.familiasAviso,
          }} />
        </div>
      </div>
    </main>
  );
}
