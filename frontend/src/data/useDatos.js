// Datos del tablero y de la vista de la maestra. Con la API (modo "api") se piden y se refrescan
// cada minuto; sin API (GitHub Pages) se quedan los datos simulados de demo.js y la pantalla lo dice.
//
// `origen` = { estado, simuladas }:
//   estado: "cargando" | "demo" (sin API) | "api" | "parcial" (algo no llegó y se muestra simulado)
//   simuladas: true si la API dice que las lecturas o el pronóstico son de prueba (regla 5 del kit)
import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, MOCK_ESCUELA, MOCK_LECTURAS, MOCK_PRONOSTICO, MOCK_SALONES } from "./demo.js";
import { mockMaestra } from "./maestras.js";
import { crearClienteDatos, haySimuladas } from "./datosApi.js";

export const apiDatos = crearClienteDatos(API_URL);
const REFRESCAR_MS = 60000;

const llego = (r) => r.status === "fulfilled";

// Vuelve a cargar cada minuto mientras haya API.
function useRefresco(activo) {
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (!activo) return undefined;
    const id = setInterval(() => setVuelta((v) => v + 1), REFRESCAR_MS);
    return () => clearInterval(id);
  }, [activo]);
  return vuelta;
}

// ¿Sigue montada la pantalla? Se pone en true en cada montaje: en desarrollo, React.StrictMode
// monta, desmonta y vuelve a montar, y sin esto se descartarían todas las respuestas de la API.
function useVivo() {
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);
  return vivo;
}

/** Escuela, salones, pronóstico y la serie del salón seleccionado. */
export function useTableroDatos(modo, seleccionado) {
  const [datos, setDatos] = useState({ escuela: MOCK_ESCUELA, salones: MOCK_SALONES, pronostico: MOCK_PRONOSTICO });
  const [lecturas, setLecturas] = useState(MOCK_LECTURAS);
  const [origen, setOrigen] = useState({ estado: "cargando", simuladas: false });
  const vivo = useVivo();
  const vuelta = useRefresco(modo === "api");

  useEffect(() => {
    if (modo === "cargando") return;
    if (modo !== "api") { setOrigen({ estado: "demo", simuladas: true }); return; }
    (async () => {
      const [e, s, p, n] = await Promise.allSettled([
        apiDatos.escuela(), apiDatos.salones(), apiDatos.pronosticoManana(), apiDatos.nodos(),
      ]);
      if (!vivo.current) return;
      setDatos((d) => ({
        escuela: llego(e) ? e.value : d.escuela,
        salones: llego(s) ? s.value : d.salones,
        pronostico: llego(p) ? p.value : d.pronostico,
      }));
      const fallas = [e, s, p].filter((r) => !llego(r)).length;
      const simuladas = (llego(n) && haySimuladas(n.value)) || (llego(p) && Boolean(p.value.simulado));
      setOrigen({ estado: fallas === 3 ? "demo" : fallas ? "parcial" : "api", simuladas: fallas === 3 || simuladas });
    })();
  }, [modo, vuelta, vivo]);

  // Serie del salón seleccionado: se pide al elegirlo y en cada refresco.
  useEffect(() => {
    if (modo !== "api" || !seleccionado) return;
    apiDatos.lecturas(seleccionado)
      .then((serie) => { if (vivo.current) setLecturas((l) => ({ ...l, [seleccionado]: serie })); })
      .catch(() => {
        if (!vivo.current) return;
        setLecturas((l) => ({ ...l, [seleccionado]: MOCK_LECTURAS[seleccionado] ?? [] }));
        setOrigen((o) => (o.estado === "api" ? { ...o, estado: "parcial" } : o));
      });
  }, [modo, seleccionado, vuelta, vivo]);

  return { ...datos, lecturas, origen };
}

/** Vista de la maestra: semáforo, alumnos con asma y "Qué hacer hoy" (con las marcas guardadas en la API). */
export function useMaestraDatos(modo, salonId) {
  const [salon, setSalon] = useState(() => mockMaestra(salonId));
  const [origen, setOrigen] = useState({ estado: "cargando", simuladas: false });
  const [errorTarea, setErrorTarea] = useState(false);
  const desdeApi = useRef(false);
  const vivo = useVivo();
  const vuelta = useRefresco(modo === "api");

  useEffect(() => {
    if (modo === "cargando") return;
    if (modo !== "api") { desdeApi.current = false; setOrigen({ estado: "demo", simuladas: true }); return; }
    (async () => {
      const [h, n] = await Promise.allSettled([apiDatos.salonHoy(salonId), apiDatos.nodos()]);
      if (!vivo.current) return;
      if (llego(h)) {
        desdeApi.current = true;
        setSalon(h.value);
        setOrigen({ estado: "api", simuladas: llego(n) && haySimuladas(n.value) });
      } else {
        desdeApi.current = false;
        setOrigen({ estado: "demo", simuladas: true });
      }
    })();
  }, [modo, salonId, vuelta, vivo]);

  const cambiarTareas = (fn) => setSalon((s) => ({ ...s, tareas: fn(s.tareas) }));

  // Se marca al instante; con API se guarda y, si falla, se regresa como estaba.
  const marcar = useCallback(async (id) => {
    setErrorTarea(false);
    const actual = salon.tareas.find((t) => t.id === id);
    if (!actual) return;
    const hecho = !actual.hecho;
    cambiarTareas((ts) => ts.map((t) => (t.id === id ? { ...t, hecho } : t)));
    if (!desdeApi.current) return;
    try {
      const tareas = await apiDatos.marcarTarea(salonId, id, hecho);
      if (vivo.current) cambiarTareas(() => tareas);
    } catch {
      if (!vivo.current) return;
      cambiarTareas((ts) => ts.map((t) => (t.id === id ? { ...t, hecho: !hecho } : t)));
      setErrorTarea(true);
    }
  }, [salon, salonId, vivo]);

  return { salon, origen, marcar, errorTarea };
}
