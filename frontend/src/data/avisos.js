// Mensaje predeterminado del aviso a familias según el semáforo y el nivel de PM2.5.
// Esto NO es mock: es la plantilla del texto. Los datos (escuela, semáforo, PM2.5) vienen de la API.
// Debe coincidir con mensaje_aviso() de bot/bot.py.
import { nivelPm25 } from "./demo.js";

const ICONO = { verde: "🟢", amarillo: "🟡", rojo: "🔴" };

// Zona de la estación de referencia (ZONA en bot/.env).
export const ZONA = "Miravalle";

// Recordatorios según el semáforo: siempre el inhalador y el medicamento de control;
// el recreo cambia con el color. Igual que CONSEJO en bot/bot.py.
const CONSEJO = {
  verde: [
    "• Recreo normal al aire libre.",
    "• Que lleve su inhalador de rescate.",
    "• No suspenda su medicamento de control.",
  ].join("\n"),
  amarillo: [
    "• Que lleve su inhalador de rescate.",
    "• El recreo será adentro para los niños con asma.",
    "• No suspenda su medicamento de control.",
  ].join("\n"),
  rojo: [
    "• Que lleve su inhalador de rescate.",
    "• El recreo y la educación física serán adentro.",
    "• No suspenda su medicamento de control.",
  ].join("\n"),
};

export const HORA_PREDETERMINADA = "07:00";
// Igual al máximo de la API (mensaje de /alertas/enviar y /alertas/programacion): si cambia allá, cambia aquí.
export const MAX_CARACTERES = 600;

export function mensajePredeterminado({ escuela, semaforo, pm25 }) {
  // Sin pronóstico (la API no tiene datos): recordatorio general, sin semáforo ni números.
  if (!semaforo || pm25 == null) {
    return [
      `Aviso de Respira GDL · ${escuela}`,
      "",
      CONSEJO.verde.split("\n").slice(1).join("\n"),
      "",
      "Responda 1 si su hijo o hija tuvo síntomas hoy (anónimo).",
      "Esto no es un diagnóstico; ante cualquier duda consulte a su médico.",
    ].join("\n");
  }
  const nivel = nivelPm25(pm25);
  return [
    `Aviso de Respira GDL · ${escuela}`,
    "",
    `${ICONO[semaforo] ?? ""} Pronóstico para mañana: ${semaforo.toUpperCase()}`,
    `PM2.5 esperado en ${ZONA}: ${pm25} µg/m³ (calidad del aire ${nivel.nombre.toLowerCase()})`,
    "",
    CONSEJO[semaforo] ?? "",
    "",
    "Responda 1 si su hijo o hija tuvo síntomas hoy (anónimo).",
    "Esto no es un diagnóstico; ante cualquier duda consulte a su médico.",
  ].join("\n");
}
