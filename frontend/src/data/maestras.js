// =====================================================================
// DATOS DE LA VISTA DE CADA MAESTRA (uno por grupo)
// Se arman con los mismos datos simulados del tablero, para que director y maestra coincidan:
// semáforo y PM2.5 de la escuela, alumnos con asma de la tabla de salones y el checklist del día.
// =====================================================================
import { MOCK_ESCUELA, MOCK_SALONES, MOCK_MAESTRA } from "./demo.js";

// TODO: CONECTAR A LA API - REEMPLAZAR MOCK DATA AQUÍ
// Endpoint esperado: GET /salones/{salonId}/hoy  (misma forma que MOCK_MAESTRA)
export function mockMaestra(salonId) {
  const s = MOCK_SALONES.find((x) => x.id === salonId) ?? MOCK_SALONES[0];
  return {
    titulo: `Maestra ${s.grupo}`,
    salonId: s.id,
    semaforo: MOCK_ESCUELA.semaforoHoy,
    pm25: MOCK_ESCUELA.pm25Hoy,
    momento: MOCK_ESCUELA.momento,
    conAsma: s.asma,
    tareas: MOCK_MAESTRA.tareas,
  };
}
// --- FIN MOCK MAESTRAS ---
