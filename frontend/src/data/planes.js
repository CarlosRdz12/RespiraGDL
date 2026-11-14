// =====================================================================
// PLANES DE ACCIÓN DE ASMA (los llena la familia en #/alumno)
// Sin nombres, sin número de lista, sin teléfonos y sin texto libre: solo opciones fijas,
// para que nunca se capture un dato que identifique al alumno.
// NO es un expediente médico ni un diagnóstico: solo recuerda qué hacer en la escuela.
// =====================================================================
import { useEffect, useState } from "react";
import { MOCK_SALONES } from "./demo.js";

// Opciones del formulario. Esto NO es mock, se queda.
export const DETONANTES = [
  { id: "polvo", nombre: "Polvo" },
  { id: "frio", nombre: "Aire frío" },
  { id: "humo", nombre: "Humo" },
  { id: "ejercicio", nombre: "Ejercicio" },
  { id: "polen", nombre: "Polen" },
  { id: "clima", nombre: "Cambios de clima" },
];

export const AVISAR_A = [
  { id: "mama", nombre: "Mamá" },
  { id: "papa", nombre: "Papá" },
  { id: "tutor", nombre: "Tutor o tutora" },
  { id: "otro", nombre: "Otro familiar" },
];

export const GRUPOS = MOCK_SALONES.map((s) => ({ id: s.id, nombre: s.grupo }));

// ---------------------------------------------------------------------
// TODO: CONECTAR A LA API - REEMPLAZAR MOCK DATA AQUÍ
// Endpoints esperados: GET /planes?salon={id}  (maestra, detalle sin identificar)
//                      GET /planes/conteo      (director, solo el número por salón)
//                      POST/PUT/DELETE /planes (familia)
// ---------------------------------------------------------------------
export const MOCK_PLANES = [
  { id: "m1", salonId: "1A", inhalador: true, detonantes: ["polvo"], avisar: "mama" },
  { id: "m2", salonId: "1A", inhalador: true, detonantes: ["frio", "ejercicio"], avisar: "papa" },
  { id: "m3", salonId: "2B", inhalador: false, detonantes: ["polen"], avisar: "mama" },
  { id: "m4", salonId: "3B", inhalador: true, detonantes: ["frio", "polvo"], avisar: "mama" },
  { id: "m5", salonId: "3B", inhalador: true, detonantes: ["humo"], avisar: "tutor" },
  { id: "m6", salonId: "3B", inhalador: false, detonantes: ["ejercicio", "clima"], avisar: "papa" },
  { id: "m7", salonId: "5A", inhalador: true, detonantes: ["humo", "polvo"], avisar: "mama" },
];
// --- FIN MOCK PLANES ---

// Planes capturados por la familia: solo en el localStorage de este navegador.
// Con la API esto se reemplaza por los endpoints de arriba.
const CLAVE = "rg-planes";
const EVENTO = "rg-planes";
let memoria = [];

function leerLocales() {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE));
    return Array.isArray(p) ? p : memoria;
  } catch {
    return memoria;
  }
}

function guardarLocales(lista) {
  memoria = lista;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento: los planes duran hasta recargar la página.
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function guardarPlan(plan) {
  const lista = leerLocales();
  const existe = lista.some((p) => p.id === plan.id);
  guardarLocales(existe ? lista.map((p) => (p.id === plan.id ? plan : p)) : [...lista, plan]);
}

export function borrarPlan(id) {
  guardarLocales(leerLocales().filter((p) => p.id !== id));
}

export const nuevoId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Hook: planes capturados en este navegador; se actualiza al guardar o borrar.
export function usePlanesLocales() {
  const [planes, setPlanes] = useState(leerLocales);
  useEffect(() => {
    const on = () => setPlanes(leerLocales());
    window.addEventListener(EVENTO, on);
    window.addEventListener("storage", on); // otra pestaña del mismo navegador
    return () => {
      window.removeEventListener(EVENTO, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return planes;
}

// Todos los planes (simulados + capturados), opcionalmente de un solo salón.
export function usePlanes(salonId) {
  const locales = usePlanesLocales();
  const todos = [...MOCK_PLANES, ...locales];
  return salonId ? todos.filter((p) => p.salonId === salonId) : todos;
}

// Texto corto de una lista de ids, p. ej. "Aire frío, polvo".
export const nombres = (ids, catalogo) =>
  ids.map((id) => catalogo.find((c) => c.id === id)?.nombre).filter(Boolean).join(", ").toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
