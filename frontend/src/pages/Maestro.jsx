import { useEffect, useState } from "react";
import { SEMAFORO } from "../data/demo.js";
import { mockMaestra } from "../data/maestras.js";
import TarjetaModal from "../components/TarjetaModal.jsx";
// import { API_URL } from "../data/demo.js"; // <- descomentar al conectar la API
import { Semaforo } from "./Tablero.jsx";
import { ResumenPlan } from "./Alumno.jsx";
import { usePlanes, DETONANTES } from "../data/planes.js";
import { salir, useSesion } from "../data/sesion.js";

// Cuenta cuántos alumnos tienen cada factor, de más a menos. Solo los que aparecen en los planes.
function contarFactores(planes) {
  return DETONANTES
    .map((d) => ({ ...d, alumnos: planes.filter((p) => p.detonantes.includes(d.id)).length }))
    .filter((d) => d.alumnos > 0)
    .sort((a, b) => b.alumnos - a.alumnos);
}
const alumnos = (n) => `${n} ${n === 1 ? "alumno" : "alumnos"}`;

// Guía general de ejemplo, NO es diagnóstico ni indicación médica.
// Debe validarla un médico y siempre manda el plan de acción de cada alumno.
// (Texto fijo del frontend, no viene de la API.)
const PASOS_CRISIS = [
  "Siéntalo derecho, quédate con él y háblale con calma.",
  "Ayúdalo a usar su inhalador de rescate como indica su plan de acción.",
  "Espera unos minutos. Si no mejora, repite como indica su plan y avisa a la dirección.",
  "Si le cuesta hablar, tiene los labios azulados o no mejora, llama al 911 y avisa a su familia.",
];

export default function Maestro() {
  // Grupo de la maestra que inició sesión (maestra1 = 1° A ... maestra6 = 6° B).
  const salonId = useSesion()?.salonId ?? "3B";

  // TODO: CONECTAR A LA API - REEMPLAZAR MOCK DATA AQUÍ
  // Resumen del salón (semáforo y número de alumnos con asma) -> GET /salones/{salonId}/hoy
  const [salon, setSalon] = useState(() => mockMaestra(salonId));

  // TODO: CONECTAR A LA API - REEMPLAZAR MOCK DATA AQUÍ
  // Checklist "Qué hacer hoy". Hoy vive solo en el navegador; si backend guarda
  // las marcas, inicializar desde GET /salones/{salonId}/hoy y mandar un POST en `marcar`.
  const [tareas, setTareas] = useState(() => mockMaestra(salonId).tareas);

  // Estado de la interfaz (no es mock): muestra u oculta la guía de crisis.
  const [crisis, setCrisis] = useState(false);

  // Planes de acción del grupo, sin datos que identifiquen al alumno (simulados + capturados en este navegador).
  const planes = usePlanes(salon.salonId);
  const factores = contarFactores(planes);

  // TODO: CONECTAR A LA API - REEMPLAZAR MOCK DATA AQUÍ
  // Al conectar: descomenten el fetch y borren MOCK_MAESTRA de demo.js y mockMaestra de maestras.js.
  useEffect(() => {
    // fetch(`${API_URL}/salones/${salonId}/hoy`).then((r) => r.json()).then((d) => {
    //   setSalon(d);
    //   setTareas(d.tareas);
    // });
  }, []);

  const marcar = (id) => {
    setTareas((t) => t.map((x) => (x.id === id ? { ...x, hecho: !x.hecho } : x)));
    // TODO: CONECTAR A LA API - REEMPLAZAR MOCK DATA AQUÍ
    // fetch(`${API_URL}/salones/${salonId}/tareas/${id}`, { method: "POST" });
  };

  return (
    <main className="rg-app rg-app--phone">
      <div className="rg-demo-note">Demo con datos simulados. La guía es un ejemplo y debe validarla un médico.</div>
      <div className="rg-phone-bar">
        <span className="rg-muted">Vista del maestro · {salon.momento}</span>
        <button type="button" className="rg-pill rg-pill--blue rg-tap" onClick={salir}>Salir</button>
      </div>
      <div className="rg-phone">
        {!crisis ? (
          <>
            <p className="rg-eyebrow">Hoy</p>
            <h1>{salon.titulo}</h1>

            <div className={`rg-today rg-aq-bg--${SEMAFORO[salon.semaforo]?.id}`}>
              <small>Semáforo de hoy</small>
              <Semaforo color={salon.semaforo} pm={salon.pm25} big />
            </div>
            <div className="rg-kpi rg-surface-mint">
              <small>Alumnos con asma en el grupo</small>
              <strong>{salon.conAsma}</strong>
              <span>Revisa que traigan su inhalador y su plan de acción.</span>
            </div>

            <h2 className="rg-phone__h2">Qué hacer hoy</h2>
            <ul className="rg-checks">
              {tareas.map((t) => (
                <li key={t.id}>
                  <label className={t.hecho ? "is-done" : ""}>
                    <input type="checkbox" checked={t.hecho} onChange={() => marcar(t.id)} />
                    {t.texto}
                  </label>
                </li>
              ))}
            </ul>

            <h2 className="rg-phone__h2">Planes de acción del grupo</h2>

            <TarjetaModal titulo="Factores a cuidar" superficie="rg-surface-mint" cta="Ver factores"
              resumen={factores.length ? factores.map((f) => f.nombre).join(", ") : "Ningún expediente indica factores"}>
              <p className="rg-muted">Lo que les detona una crisis a los alumnos del grupo, según sus expedientes.</p>
              {factores.length ? (
                <ul className="rg-plans">
                  {factores.map((f) => (
                    <li key={f.id} className="rg-plan rg-plan--row rg-surface-ice">
                      <strong>{f.nombre}</strong><span>{alumnos(f.alumnos)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Ningún expediente indica factores.</p>
              )}
            </TarjetaModal>

            <TarjetaModal titulo="Expedientes" superficie="rg-surface-lilac" cta="Ver expedientes"
              resumen={`${alumnos(planes.length)} con expediente`}>
              <p className="rg-modal__count">{alumnos(planes.length)} con expediente</p>
              {planes.length > 0 && (
                <ul className="rg-plans">
                  {planes.map((p) => (
                    <li key={p.id} className="rg-plan rg-surface-ice"><ResumenPlan plan={p} /></li>
                  ))}
                </ul>
              )}
              <p className="rg-muted">Sin datos que identifiquen al alumno. No es diagnóstico: recuerda qué hacer en la escuela.</p>
            </TarjetaModal>

            <button className="rg-pill rg-pill--danger rg-full rg-sos" onClick={() => setCrisis(true)}>
              Un alumno tiene una crisis
            </button>
          </>
        ) : (
          <>
            <button className="rg-pill rg-pill--blue rg-tap" onClick={() => setCrisis(false)}>← Volver</button>
            <h1>Guía de crisis</h1>
            <ol className="rg-steps">
              {PASOS_CRISIS.map((p, i) => (
                <li key={i} className="rg-step rg-surface-ice">
                  <span className="rg-step__n">{i + 1}</span>
                  <p>{p}</p>
                </li>
              ))}
            </ol>
            <a className="rg-pill rg-pill--danger rg-full rg-sos" href="tel:911">Llamar al 911</a>
            <p className="rg-muted">Guía general de ejemplo. Siempre sigue el plan de acción del alumno.</p>
          </>
        )}
      </div>
    </main>
  );
}
