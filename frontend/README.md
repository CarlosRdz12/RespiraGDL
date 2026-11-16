# Frontend Respira GDL

Landing, tablero de la escuela y vista del maestro. React 18 + Vite, sin más dependencias.

En vivo: https://ceilingofe.github.io/respiragdl/ (se publica solo en cada push a `main` que toque `frontend/`).

| Ruta | Qué es |
| --- | --- |
| `#/` | Landing con el hero rotativo de los 3 pilares |
| `#/tablero` | Tablero del director: semáforo, alertas por salón, gráfica fuera/dentro (Recharts), tabla de salones y pronóstico |
| `#/maestro` | Vista de celular de la maestra de cada grupo: semáforo, alumnos con asma, checklist del día, factores a cuidar y expedientes del grupo (ventanas modales, sin identificar) y botón de crisis |
| `#/alumno` | Vista de la familia: llena, edita o borra el plan de asma de su hijo (sin nombre ni teléfono) |
| `#/entrar` | Inicio de sesión simulado |

## Acceso (simulado)

Cada rol solo entra a su pantalla; si abre otra, lo regresa a la suya. La landing es pública.

| Usuario | Contraseña | Pantalla |
| --- | --- | --- |
| `director` | `director` | `#/aula` al entrar, con botón a `#/tablero` y de regreso (ve cuántos planes hay por salón, solo el número) |
| `maestra1` … `maestra6` | igual al usuario | `#/maestro` de su grupo: 1° A, 2° A, 3° A, 4° B, 5° A, 6° B. Ve sus factores a cuidar y sus expedientes (sin identificar) en ventanas modales |
| `familia` | `familia` | `#/alumno` |

**No es seguridad real:** la página está en GitHub Pages y los usuarios están en `src/data/sesion.js`. El acceso real lo dará la API (`TODO: CONECTAR A LA API`). Los planes que captura la familia se guardan solo en el `localStorage` de ese navegador; los simulados están en `src/data/planes.js`.

## Correrlo

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
```

## Datos

Todo sale de `src/data/demo.js` y **es simulado**. Busquen `TODO: CONECTAR A LA API`: cada `useState` arranca con un `MOCK_*` y cada página trae un `useEffect` con el `fetch` comentado (`/salones`, `/lecturas`, `/pronostico/manana`, `/salones/3A/hoy`). Para conectar: descomenten el fetch, borren el bloque `MOCK_*` y pongan la URL en `frontend/.env.local` como `VITE_API_URL=...`.

### Aviso a familias (ya conectado)

El aviso a familias del tablero ya usa la API (`src/data/avisosApi.js` y `src/data/useAvisos.js`):

| Qué | Ruta | Sin API (GitHub Pages) |
| --- | --- | --- |
| Botón "Enviar aviso a familias" de la tarjeta de pronóstico | `POST /alertas/enviar` sin mensaje (la API usa su texto sugerido) | Se simula y dice "(simulado)" |
| "Enviar ahora" de la ventana | `POST /alertas/enviar` con el mensaje escrito | Se simula y dice "(simulado)" |
| Confirmación del envío | `GET /alertas/aviso` cada 4 s hasta que el bot lo marca enviado (máx. 2 min) | — |
| Hora del aviso diario y nota de la escuela | `GET`/`PUT /alertas/programacion` (la nota es `mensaje`; el bot la agrega debajo del pronóstico) | Se guardan en este navegador |

Al abrir el tablero se consulta `GET /salud`: si responde, todo va a la API y la pantalla deja de decir "(simulado)". Si la API responde pero no tiene una ruta, la pantalla muestra el error en vez de fingir que se envió. Los mensajes tienen máximo 600 caracteres, igual que la API.

## Diseño

Todo el frontend sigue la [guía de diseño](../docs/diseno/README.md). `src/styles/tokens.css` tiene las variables y `src/styles/app.css` los componentes; no usen hex sueltos. Las ilustraciones de `src/art/Art.jsx` son SVG temporales hasta tener fotos con licencia.
