// Nota de arriba de cada pantalla: dice de dónde salen los datos (regla 5 del kit:
// declarar qué parte está simulada). `origen` viene de useTableroDatos o useMaestraDatos.
const TEXTOS = {
  cargando: "Cargando datos…",
  demo: "Demo con datos simulados: no hay conexión con la API.",
  parcial: "Algunos datos no llegaron de la API; esos se muestran simulados.",
};

export default function NotaDatos({ origen, extra }) {
  let texto = TEXTOS[origen.estado];
  if (origen.estado === "api") {
    texto = origen.simuladas
      ? "Datos de la API con lecturas simuladas (sin sensores físicos)."
      : "Datos en vivo de los sensores y la API.";
  }
  return (
    <div className="rg-demo-note" role="status">
      {texto}{extra ? ` ${extra}` : ""}
    </div>
  );
}
