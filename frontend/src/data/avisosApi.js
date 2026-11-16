// Cliente de la API para el aviso a familias (backend/app/api/alertas.py, PR #38).
// No importa React ni demo.js para poder probarlo con Node; el componente le pasa API_URL.
//
// Flujo de un aviso: el tablero hace POST /alertas/enviar -> queda pendiente -> el bot de Telegram
// lo reparte (revisa cada 30 s) y lo marca enviado con el número de familias.

// Escuela de la demo; la misma que usan el bot (ESCUELA_ID) y backend/scripts/cargar_demo.py.
export const ESCUELA_ID = "miravalle";

export function crearClienteAvisos(base, { fetchFn = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const url = (ruta) => `${String(base).replace(/\/+$/, "")}${ruta}`;

  async function pedir(ruta, { metodo = "GET", cuerpo } = {}) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), timeoutMs);
    try {
      const r = await fetchFn(url(ruta), {
        method: metodo,
        headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: control.signal,
      });
      if (!r.ok) throw new Error(`La API respondió ${r.status} en ${metodo} ${ruta}`);
      return await r.json();
    } finally {
      clearTimeout(reloj);
    }
  }

  const qs = `escuela_id=${encodeURIComponent(ESCUELA_ID)}`;
  const limpiar = (texto) => {
    const t = (texto ?? "").trim();
    return t === "" ? null : t;
  };

  return {
    /** {hora: "07:00", nota: string|null}. `mensaje` en la API es la nota que el bot agrega al aviso diario. */
    async leerProgramacion() {
      const p = await pedir(`/alertas/programacion?${qs}`);
      return { hora: p.hora, nota: limpiar(p.mensaje) };
    },

    /** El PUT reemplaza hora y mensaje: siempre se mandan los dos para no borrar el otro. */
    async guardarProgramacion({ hora, nota }) {
      const p = await pedir("/alertas/programacion", {
        metodo: "PUT",
        cuerpo: { hora, mensaje: limpiar(nota), escuela_id: ESCUELA_ID },
      });
      return { hora: p.hora, nota: limpiar(p.mensaje) };
    },

    /** Deja el aviso pendiente para el bot. Sin mensaje, la API usa su texto sugerido. Regresa el aviso con su id. */
    async enviarAviso(mensaje) {
      const cuerpo = { escuela_id: ESCUELA_ID };
      const texto = limpiar(mensaje);
      if (texto) cuerpo.mensaje = texto;
      return pedir("/alertas/enviar", { metodo: "POST", cuerpo });
    },

    /** Busca el aviso en el historial: {enviado: null|fecha, familias: null|n}. null si ya no aparece. */
    async estadoAviso(id) {
      const lista = await pedir(`/alertas/aviso?${qs}&limite=50`);
      return lista.find((a) => a.id === id) ?? null;
    },

    async salud() {
      return pedir("/salud");
    },
  };
}
