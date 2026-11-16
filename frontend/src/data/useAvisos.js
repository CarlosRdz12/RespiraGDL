// Hooks del aviso a familias. Si la API no responde (p. ej. en GitHub Pages, donde no hay backend),
// todo sigue funcionando como demo simulada y la pantalla lo dice.
import { useEffect, useRef, useState } from "react";
import { API_URL } from "./demo.js";
import { crearClienteAvisos } from "./avisosApi.js";

// Un solo cliente para toda la app (identidad estable para los useEffect).
export const apiAvisos = crearClienteAvisos(API_URL);

// Cada cuánto se pregunta si el bot ya repartió el aviso, y cuánto se espera como máximo.
const REVISAR_CADA_MS = 4000;
const ESPERA_MAXIMA_MS = 120000;

const horaActual = () => new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

/** "cargando" | "api" | "local". Una sola consulta al abrir la pantalla. */
export function useConexionApi(api) {
  const [modo, setModo] = useState("cargando");
  useEffect(() => {
    let vivo = true;
    api.salud().then(() => vivo && setModo("api")).catch(() => vivo && setModo("local"));
    return () => { vivo = false; };
  }, [api]);
  return modo;
}

/**
 * Envío inmediato de un aviso.
 * estado: "listo" | "enviando" | "en-cola" (la API lo guardó; el bot aún no lo manda) |
 *         "enviado" | "sin-confirmar" (el bot no lo marcó a tiempo) | "error"
 * Con modo "local" se simula como antes (simulado: true).
 */
export function useEnvioAviso(api, modo) {
  const [envio, setEnvio] = useState({ estado: "listo" });
  const timers = useRef([]);
  const vivo = useRef(true);

  const limpiar = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; limpiar(); };
  }, []);
  const poner = (valor) => { if (vivo.current) setEnvio(valor); };
  const despues = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

  const revisar = (id, inicio) => {
    despues(async () => {
      try {
        const aviso = await api.estadoAviso(id);
        if (aviso?.enviado) {
          poner({ estado: "enviado", familias: aviso.familias ?? 0, hora: horaActual() });
          return;
        }
      } catch { /* la API se cayó un momento: se vuelve a intentar */ }
      if (Date.now() - inicio >= ESPERA_MAXIMA_MS) poner({ estado: "sin-confirmar" });
      else revisar(id, inicio);
    }, REVISAR_CADA_MS);
  };

  const enviar = async (mensaje) => {
    limpiar();
    setEnvio({ estado: "enviando" });
    if (modo !== "api") {
      despues(() => poner({ estado: "enviado", simulado: true, hora: horaActual() }), 1200);
      return;
    }
    try {
      const aviso = await api.enviarAviso(mensaje);
      poner({ estado: "en-cola" });
      revisar(aviso.id, Date.now());
    } catch {
      poner({ estado: "error" });
    }
  };

  const reiniciar = () => { limpiar(); setEnvio({ estado: "listo" }); };

  return { envio, enviar, reiniciar };
}
