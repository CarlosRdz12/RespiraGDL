import { useEffect, useState } from "react";
import { Navbar, Footer, useReveal } from "./components/Layout.jsx";
import Landing from "./pages/Landing.jsx";
import Tablero from "./pages/Tablero.jsx";
import Maestro from "./pages/Maestro.jsx";
import Alumno from "./pages/Alumno.jsx";
import Entrar from "./pages/Entrar.jsx";
import { ROLES, useSesion } from "./data/sesion.js";

// Pantallas protegidas: cada una solo la ve su rol. La landing y #/entrar son públicas.
const PROTEGIDAS = {
  "/tablero": { rol: "director", Page: Tablero },
  "/maestro": { rol: "maestra", Page: Maestro },
  "/alumno": { rol: "familia", Page: Alumno },
};

// Rutas con hash para que funcione en GitHub Pages sin servidor: #/, #/tablero, #/maestro, #/#seccion
function parse() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, anchor] = raw.split("#");
  return { path: path || "/", anchor };
}

const Vacio = () => <main className="rg-app" />;

export default function App() {
  const [{ path, anchor }, setLoc] = useState(parse);
  const sesion = useSesion();

  // Sin sesión -> #/entrar. Con sesión de otro rol -> a su propia pantalla.
  const protegida = PROTEGIDAS[path];
  const destino = protegida && protegida.rol !== sesion?.rol
    ? (sesion ? ROLES[sesion.rol].ruta : "/entrar")
    : null;
  useEffect(() => {
    if (destino) window.location.replace(`#${destino}`);
  }, [destino]);

  useEffect(() => {
    const on = () => setLoc(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo(0, 0);
  }, [path, anchor]);
  useReveal(path);

  // Mientras redirige no se pinta la pantalla protegida ni un instante.
  const Page = destino ? Vacio : protegida ? protegida.Page : path === "/entrar" ? Entrar : Landing;
  return (
    <>
      <Navbar route={path} sesion={sesion} />
      <Page />
      <Footer />
    </>
  );
}
