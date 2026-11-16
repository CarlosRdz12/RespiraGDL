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
    /** Serie del día de un salón: [{h, fuera, dentro}]. Usa /lecturas/serie porque existe en todas las
     *  versiones de la API (el atajo /lecturas?salon=…&fecha=hoy solo existe desde el PR #38; antes
     *  devuelve lecturas crudas). Si la forma no es la esperada, lanza error y el tablero usa el respaldo. */
    lecturas: async (salonId) => {
      const serie = await pedir(`/lecturas/serie?salon_id=${enc(salonId)}`);
      if (!esSerie(serie)) throw new Error("La API no mandó la serie con la forma {h, fuera, dentro}");
      return serie;
    },
    /** Última lectura de cada nodo; `simulada` dice si viene de simular_nodos/cargar_demo. */
    nodos: () => pedir("/lecturas/nodos"),
    /** Vista de la maestra (forma de MOCK_MAESTRA). */
    salonHoy: (salonId) => pedir(`/salones/${enc(salonId)}/hoy`),
    /** Marca o desmarca una tarea de hoy. Regresa la lista de tareas actualizada. */
    marcarTarea: (salonId, tareaId, hecho) =>
      pedir(`/salones/${enc(salonId)}/tareas/${enc(tareaId)}?hecho=${hecho ? "true" : "false"}`, { metodo: "POST" }),
  };
}

/** true si es una serie del tablero: lista de {h: "7:00", fuera, dentro}. Una lista vacía también vale. */
export function esSerie(serie) {
  return Array.isArray(serie) && serie.every((x) => x && typeof x.h === "string" && "fuera" in x && "dentro" in x);
}

/** true si alguna lectura de los nodos es simulada (regla 5 del kit: decir qué parte está simulada). */
export function haySimuladas(nodos) {
  return Array.isArray(nodos) && nodos.some((n) => Boolean(n.simulada));
}
