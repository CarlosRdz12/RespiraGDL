# Bot de alertas para familias

Bot de Telegram (gratis) que avisa a las familias de alumnos con asma el pronóstico de mañana (semáforo y PM2.5) y reparte los avisos que mandan el director o la maestra desde el tablero. Si el día viene malo, recuerda el inhalador y el plan de acción.

El bot no da diagnósticos: solo avisa y recuerda seguir el plan de acción de cada alumno.

## Correrlo

```bash
cd bot
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # y pegar el token de @BotFather en TELEGRAM_TOKEN
python bot.py
```

Para el pronóstico real, levanten también la API de Juan (`backend/README.md`) y pongan su URL en `API_URL`. Sin API el bot funciona con datos de ejemplo y lo dice en cada mensaje.

## Comandos

| Mensaje | Respuesta |
| --- | --- |
| `/start` | Registra a la familia y le pide, con botones, los grupos de sus hijos (puede marcar varios). No pide nombres |
| `/grupos` | Cambia los grupos |
| `/manana` | Pronóstico de mañana solo a quien lo pide |
| `/simular` | Simula el aviso a **toda la escuela** con el pronóstico actual |
| `/simular rojo` · `amarillo` · `verde` | Lo mismo forzando ese color (PM2.5 de ejemplo: 95, 40, 18) |
| `/simular 3A` · `/simular amarillo 3A` | Simula el aviso solo a las familias de ese grupo, como lo haría la maestra |
| `/hora` · `/hora 06:30` | Muestra o cambia la hora del aviso automático (hora de Guadalajara) |
| `/salir` | Deja de recibir avisos y borra los datos de la familia |
| `1` | Registra que un niño tuvo síntomas hoy (solo cuenta, sin nombres) |

Grupos: 1A, 2A, 3A, 4B, 5A, 6B (los mismos del frontend y del backend).

## De dónde salen los datos

| Qué | Fuente | Si no está |
| --- | --- | --- |
| Pronóstico de mañana | `GET /pronostico` de la API (día "Mañana") | Datos de ejemplo (PM2.5 71) con la nota "Datos de ejemplo" |
| Semáforo | Cortes de la NOM-172-SEMARNAT-2023: verde ≤25, amarillo ≤79, rojo >79 µg/m³ (iguales a `backend/app/core/semaforo.py`) | — |
| Avisos del tablero y de la maestra | `GET /alertas/aviso/pendientes` cada `INTERVALO_AVISOS` s; luego `POST /alertas/aviso/{id}/enviado` con `{"familias": n}` | **Todavía no existe en la API** (pedido a Juan). El bot lo anota una vez en el log y sigue reintentando en silencio |

- **Aviso automático:** todos los días a las `HORA_AVISO` (07:00 si no se pone). **No se manda** si el pronóstico real no está disponible o está desactualizado: nunca sale con datos de ejemplo.
- **Avisos con grupo:** si el aviso trae `grupo` (ej. `"3A"`), solo llega a las familias que marcaron ese grupo; sin grupo, a toda la escuela.
- **Un aviso no se repite:** el bot recuerda los ids que ya repartió, aunque falle el marcado en la API.

## Datos guardados

Las familias se guardan en `bot/datos/familias.json` para no perderlas al reiniciar. Solo contiene el número de chat de Telegram y los grupos marcados, el conteo de reportes de síntomas **del día** y los ids de avisos repartidos. **`bot/datos/` está en `.gitignore`: nunca se sube al repo.** Si una familia bloquea el bot o escribe `/salir`, se borra.

Pendiente con la API (marcado con `TODO: CONECTAR A LA API` en `bot.py`): `POST /suscripciones`, `POST /reportes-sintomas` y leer la hora del aviso de `GET /alertas/programacion`.
