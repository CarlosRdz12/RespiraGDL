// Cliente de la API para los datos del tablero y de la vista de la maestra (backend PR #38).
// Sin React ni demo.js para poder probarlo con Node; useDatos.js le pasa API_URL.
import { crearPedir, ESCUELA_ID } from "./avisosApi.js";

export function crearClienteDatos(base, opciones = {}) {
  const pedir = crearPedir(base, opciones);
  const enc = encodeURIComponent;
  return {
    /** Encabezado del tablero (forma de MOCK_ESCUELA). */
    escuela: () => pedir(`/escuelas/${enc(ESCUELA_ID)}`),
    /** Filas de la tabla: {id, grupo, fuera, dentro, proteccion, asma, filtro, ...}. */
    salones: () => pedir(`/salones?escuela=${enc(ESCUELA_ID)}`),
    /** Tarjeta de pronóstico (forma de MOCK_PRONOSTICO + desactualizado y simulado). */
    pronosticoManana: () => pedir(`/pronostico/manana?escuela_id=${enc(ESCUELA_ID)}`),
    /** Serie del día de un salón: [{h, fuera, dentro}] de 7:00 a 16:00. */
    lecturas: (salonId) => pedir(`/lecturas?salon=${enc(salonId)}&fecha=hoy`),
    /** Última lectura de cada nodo; `simulada` dice si viene de simular_nodos/cargar_demo. */
    nodos: () => pedir("/lecturas/nodos"),
    /** Vista de la maestra (forma de MOCK_MAESTRA). */
    salonHoy: (salonId) => pedir(`/salones/${enc(salonId)}/hoy`),
    /** Marca o desmarca una tarea de hoy. Regresa la lista de tareas actualizada. */
    marcarTarea: (salonId, tareaId, hecho) =>
      pedir(`/salones/${enc(salonId)}/tareas/${enc(tareaId)}?hecho=${hecho ? "true" : "false"}`, { metodo: "POST" }),
  };
}

/** true si alguna lectura de los nodos es simulada (regla 5 del kit: decir qué parte está simulada). */
export function haySimuladas(nodos) {
  return Array.isArray(nodos) && nodos.some((n) => Boolean(n.simulada));
}
