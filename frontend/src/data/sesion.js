// =====================================================================
// INICIO DE SESIÓN SIMULADO PARA LA DEMO
// La página vive en GitHub Pages (sin servidor), así que esto NO es seguridad real:
// las contraseñas se ven en el código. Solo separa las pantallas por rol en la demo.
// TODO: CONECTAR A LA API - REEMPLAZAR MOCK DATA AQUÍ
// Con la API: POST /sesion { usuario, clave } -> { rol, salonId, token } y guardar el token.
// =====================================================================
import { useEffect, useState } from "react";
import { MOCK_SALONES } from "./demo.js";

export const ROLES = {
  director: { nombre: "Director", ruta: "/tablero" },
  maestra: { nombre: "Maestra", ruta: "/maestro" },
  familia: { nombre: "Familia del alumno", ruta: "/alumno" },
};

// Usuarios fáciles de la demo: usuario = contraseña. Una maestra por grupo (maestra1 = 1° A ... maestra6 = 6° B).
export const MOCK_USUARIOS = [
  { usuario: "director", clave: "director", rol: "director" },
  ...MOCK_SALONES.map((s, i) => ({
    usuario: `maestra${i + 1}`, clave: `maestra${i + 1}`, rol: "maestra", salonId: s.id,
    etiqueta: `Maestra ${s.grupo}`,
  })),
  { usuario: "familia", clave: "familia", rol: "familia" },
];
// --- FIN MOCK USUARIOS ---

const CLAVE = "rg-sesion";
const EVENTO = "rg-sesion";
// Respaldo en memoria por si el navegador bloquea el almacenamiento (dura hasta recargar).
let memoria = null;

// Lee la sesión guardada. sessionStorage: se cierra sola al cerrar la pestaña.
export function leerSesion() {
  let s = memoria;
  try {
    s = JSON.parse(sessionStorage.getItem(CLAVE)) ?? memoria;
  } catch {
    // Sin almacenamiento: usar la copia en memoria.
  }
  return s && ROLES[s.rol] ? s : null;
}

function guardar(s) {
  memoria = s;
  try {
    if (s) sessionStorage.setItem(CLAVE, JSON.stringify(s));
    else sessionStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: queda la copia en memoria.
  }
  window.dispatchEvent(new Event(EVENTO));
}

// Devuelve la sesión o null si el usuario o la contraseña no coinciden.
export function entrar(usuario, clave) {
  const u = MOCK_USUARIOS.find(
    (x) => x.usuario === usuario.trim().toLowerCase() && x.clave === clave
  );
  if (!u) return null;
  const sesion = { usuario: u.usuario, rol: u.rol, salonId: u.salonId };
  guardar(sesion);
  return sesion;
}

export function salir() {
  guardar(null);
  window.location.hash = "#/entrar";
}

// Hook: la sesión actual y se actualiza al entrar o salir.
export function useSesion() {
  const [sesion, setSesion] = useState(leerSesion);
  useEffect(() => {
    const on = () => setSesion(leerSesion());
    window.addEventListener(EVENTO, on);
    return () => window.removeEventListener(EVENTO, on);
  }, []);
  return sesion;
}
