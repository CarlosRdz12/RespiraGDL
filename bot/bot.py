"""Bot de Telegram de Respira GDL: avisos de calidad del aire para familias de alumnos con asma.

Comandos:
  /start            registra a la familia y le pide los grupos de sus hijos (sin nombres)
  /grupos           cambia los grupos (puede marcar varios: hermanos en otros grupos)
  /manana           muestra el pronóstico de mañana (semáforo + PM2.5) solo a quien lo pide
  /simular [color] [grupo]
                    simula el aviso a las familias registradas. color = verde | amarillo | rojo;
                    grupo = 1A, 2A, 3A, 4B, 5A, 6B (sin grupo va a toda la escuela)
  /hora [HH:MM]     muestra o cambia la hora del aviso automático diario (hora de Guadalajara)
  /salir            deja de recibir avisos y borra los datos de la familia
  "1"               la familia avisa que su hijo/a tuvo síntomas; solo se cuenta

Además, cada INTERVALO_AVISOS segundos revisa en la API los avisos que mandaron el director o la
maestra desde el tablero (GET /alertas/aviso/pendientes) y los reparte por grupo.

Correr:  python bot.py   (lee TELEGRAM_TOKEN y API_URL de bot/.env)
No es una herramienta de diagnóstico: solo avisa y recuerda seguir el plan de acción.
"""

import json
import logging
import math
import os
import re
from datetime import datetime, time, timedelta, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.error import Forbidden, TelegramError
from telegram.ext import (
    Application, CallbackQueryHandler, CommandHandler, ContextTypes, MessageHandler, filters,
)

load_dotenv(Path(__file__).with_name(".env"))
# Acepta los dos nombres: TELEGRAM_TOKEN (bot/.env.example) o TELEGRAM_BOT_TOKEN (.env.example de la raíz).
TOKEN = os.getenv("TELEGRAM_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
API_URL = os.getenv("API_URL", "http://localhost:8000").rstrip("/")
ESCUELA_ID = os.getenv("ESCUELA_ID", "miravalle")
ESCUELA_NOMBRE = os.getenv("ESCUELA_NOMBRE", "Esc. Prim. Miravalle T/M")
INTERVALO_AVISOS = int(os.getenv("INTERVALO_AVISOS", "30"))
# Aquí se guardan las familias (solo chat de Telegram y grupos). Está en .gitignore: nunca se sube.
DATOS_PATH = Path(os.getenv("DATOS_PATH", str(Path(__file__).with_name("datos") / "familias.json")))

logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s", level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)  # no llenar el log con cada consulta a la API
log = logging.getLogger("respira-bot")

# Guadalajara está en UTC-6 todo el año (México quitó el horario de verano en 2022).
ZONA_GDL = timezone(timedelta(hours=-6), "Guadalajara")

# Mismos grupos que frontend/src/data/demo.js y backend/scripts/cargar_demo.py.
GRUPOS = [("1A", "1° A"), ("2A", "2° A"), ("3A", "3° A"), ("4B", "4° B"), ("5A", "5° A"), ("6B", "6° B")]
NOMBRE_GRUPO = dict(GRUPOS)

# Cortes de PM2.5 de la NOM-172-SEMARNAT-2023 (desde enero de 2026), iguales a
# backend/app/core/semaforo.py y frontend/src/data/demo.js: si cambian, cambien los tres.
# (máximo µg/m³, nombre del nivel, color del semáforo de la escuela)
NIVELES = [
    (15, "Buena", "verde"),
    (25, "Aceptable", "verde"),
    (79, "Mala", "amarillo"),
    (130, "Muy mala", "rojo"),
    (math.inf, "Extremadamente mala", "rojo"),
]


def nivel(pm25: float) -> tuple[str, str]:
    """(nombre del nivel, color del semáforo) para un PM2.5 en µg/m³."""
    for maximo, nombre, color in NIVELES:
        if pm25 <= maximo:
            return nombre, color
    raise AssertionError("inalcanzable")


ICONO = {"verde": "🟢", "amarillo": "🟡", "rojo": "🔴"}
# Mismo texto que frontend/src/data/avisos.js.
CONSEJO = {
    "verde": "Recreo normal al aire libre.",
    "amarillo": "Si su hijo o hija tiene asma, revise que lleve su inhalador y su plan de acción.",
    "rojo": (
        "El recreo y la educación física serán adentro. "
        "Revise que lleve su inhalador y su plan de acción."
    ),
}

# Datos de ejemplo: se usan solo si la API no responde o su pronóstico está desactualizado,
# y el mensaje lo dice. El aviso automático diario nunca sale con estos datos.
MOCK_PM25_MANANA = 71
MOCK_PM25_POR_COLOR = {"verde": 18, "amarillo": 40, "rojo": 95}


# ---------------------------------------------------------------------
# Datos guardados (familias, reportes del día y avisos ya repartidos)
# ---------------------------------------------------------------------
def cargar_datos() -> dict:
    try:
        datos = json.loads(DATOS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        datos = {}
    except (OSError, json.JSONDecodeError) as e:
        log.error("No se pudo leer %s (%s); se empieza vacío.", DATOS_PATH, e)
        datos = {}
    datos.setdefault("familias", {})          # {"<chat_id>": {"grupos": ["3A", ...]}}
    datos.setdefault("reportes", {})          # {"2026-11-15": 2}
    datos.setdefault("avisos_enviados", [])   # ids de /alertas/aviso ya repartidos
    return datos


def guardar_datos(datos: dict) -> None:
    DATOS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATOS_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(DATOS_PATH)  # se reemplaza de golpe: si se corta la luz no queda el archivo a medias


DATOS = cargar_datos()


def familia(chat_id: int) -> dict | None:
    return DATOS["familias"].get(str(chat_id))


def chats_de(grupo: str | None) -> list[int]:
    """Chats a los que va un aviso: toda la escuela (grupo None) o las familias de ese grupo."""
    return [int(c) for c, f in DATOS["familias"].items() if grupo is None or grupo in f["grupos"]]


# ---------------------------------------------------------------------
# API de Juan (backend/README.md)
# ---------------------------------------------------------------------
def cliente(context: ContextTypes.DEFAULT_TYPE) -> httpx.AsyncClient:
    return context.application.bot_data["http"]


async def obtener_pronostico(context: ContextTypes.DEFAULT_TYPE) -> dict:
    """Pronóstico de mañana. Si la API falla o está desactualizada, datos de ejemplo con simulado=True."""
    try:
        r = await cliente(context).get(f"{API_URL}/pronostico")
        r.raise_for_status()
        p = r.json()
        manana = next((d for d in p.get("dias", []) if d.get("dia") == "Mañana"), None)
        if manana is None or p.get("desactualizado"):
            raise ValueError("pronóstico sin día de mañana o desactualizado")
        pm = round(float(manana["pm"]))
        nombre, color = nivel(pm)
        return {"pm25": pm, "nivel": manana.get("nombre", nombre), "semaforo": manana.get("semaforo", color),
                "simulado": False}
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
        log.info("Pronóstico de la API no disponible (%s); se usan datos de ejemplo.", e)
        return pronostico_ejemplo(MOCK_PM25_MANANA)


def pronostico_ejemplo(pm: int) -> dict:
    nombre, color = nivel(pm)
    return {"pm25": pm, "nivel": nombre, "semaforo": color, "simulado": True}


def mensaje_aviso(p: dict) -> str:
    """Texto del aviso a familias sobre mañana. Mismo formato que frontend/src/data/avisos.js."""
    color = p["semaforo"]
    texto = (
        f"Aviso de Respira GDL · {ESCUELA_NOMBRE}\n\n"
        f"{ICONO.get(color, '')} Pronóstico para mañana: {color.upper()}\n"
        f"PM2.5 esperado: {p['pm25']} µg/m³ (calidad del aire {p['nivel'].lower()})\n\n"
        f"{CONSEJO.get(color, '')}\n\n"
        "Si su hijo o hija tuvo tos, silbido en el pecho o le faltó el aire hoy, responda 1.\n"
        "Esto no es un diagnóstico; ante cualquier duda consulte a su médico."
    )
    if p.get("simulado"):
        texto += "\n\n(Datos de ejemplo: el pronóstico real no está disponible ahora.)"
    return texto


async def enviar(context: ContextTypes.DEFAULT_TYPE, chats: list[int], texto: str) -> int:
    """Manda el texto a cada chat. Si una familia bloqueó el bot, se da de baja. Regresa cuántos llegaron."""
    enviados = 0
    for chat_id in chats:
        try:
            await context.bot.send_message(chat_id=chat_id, text=texto)
            enviados += 1
        except Forbidden:
            DATOS["familias"].pop(str(chat_id), None)
            guardar_datos(DATOS)
            log.info("Una familia bloqueó el bot; se dio de baja.")
        except TelegramError as e:
            log.warning("No se pudo enviar a un chat: %s", e)
    return enviados


# ---------------------------------------------------------------------
# Registro de la familia y sus grupos
# ---------------------------------------------------------------------
def teclado_grupos(chat_id: int) -> InlineKeyboardMarkup:
    elegidos = familia(chat_id)["grupos"]
    botones = [
        InlineKeyboardButton(f"{'✅ ' if gid in elegidos else ''}{nombre}", callback_data=f"g:{gid}")
        for gid, nombre in GRUPOS
    ]
    filas = [botones[i:i + 3] for i in range(0, len(botones), 3)]
    filas.append([InlineKeyboardButton("Listo", callback_data="g:listo")])
    return InlineKeyboardMarkup(filas)


def texto_grupos(chat_id: int) -> str:
    elegidos = familia(chat_id)["grupos"]
    return ", ".join(NOMBRE_GRUPO[g] for g in elegidos) if elegidos else "ninguno"


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    if familia(chat_id) is None:
        DATOS["familias"][str(chat_id)] = {"grupos": []}
        guardar_datos(DATOS)
    # TODO: CONECTAR A LA API - cuando exista: POST {API_URL}/suscripciones
    await update.message.reply_text(
        "Hola, soy el bot de Respira GDL. Cuando el aire de mañana venga malo le avisaré "
        "con el semáforo de la escuela.\n\n"
        "¿En qué grupo están sus hijos? Puede marcar varios. No le pediremos nombres.",
        reply_markup=teclado_grupos(chat_id),
    )


async def grupos(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    if familia(chat_id) is None:
        await update.message.reply_text("Primero escriba /start para registrarse.")
        return
    await update.message.reply_text(
        f"Grupos actuales: {texto_grupos(chat_id)}.\nToque un grupo para marcarlo o quitarlo.",
        reply_markup=teclado_grupos(chat_id),
    )


async def elegir_grupo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = query.message.chat.id
    f = familia(chat_id)
    if f is None:
        await query.answer("Escriba /start para registrarse.")
        return
    valor = query.data.removeprefix("g:")
    if valor == "listo":
        await query.answer()
        await query.edit_message_text(
            f"Listo. Recibirá los avisos de la escuela y de: {texto_grupos(chat_id)}.\n\n"
            "/manana muestra el pronóstico de mañana · /grupos cambia sus grupos · /salir deja de recibir avisos."
        )
        return
    if valor in NOMBRE_GRUPO:
        f["grupos"] = [g for g in f["grupos"] if g != valor] if valor in f["grupos"] else f["grupos"] + [valor]
        f["grupos"].sort()
        guardar_datos(DATOS)
    await query.answer()
    await query.edit_message_reply_markup(reply_markup=teclado_grupos(chat_id))


async def salir(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if DATOS["familias"].pop(str(update.effective_chat.id), None) is not None:
        guardar_datos(DATOS)
    await update.message.reply_text("Listo, ya no recibirá avisos y borramos sus datos. Escriba /start para volver.")


# ---------------------------------------------------------------------
# Pronóstico, simulación y síntomas
# ---------------------------------------------------------------------
async def manana(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(mensaje_aviso(await obtener_pronostico(context)))


async def simular(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Simula el envío del aviso a las familias: a toda la escuela o a un grupo."""
    args = [a.upper() for a in context.args]
    color = next((a.lower() for a in args if a.lower() in ICONO), None)
    grupo = next((a for a in args if a in NOMBRE_GRUPO), None)
    if len(args) > (color is not None) + (grupo is not None):
        await update.message.reply_text(
            "Use /simular, /simular rojo, /simular 3A o /simular amarillo 3A.\n"
            f"Grupos: {', '.join(NOMBRE_GRUPO)}."
        )
        return
    p = pronostico_ejemplo(MOCK_PM25_POR_COLOR[color]) if color else await obtener_pronostico(context)
    if familia(update.effective_chat.id) is None:  # quien prueba también recibe el aviso
        DATOS["familias"][str(update.effective_chat.id)] = {"grupos": [grupo] if grupo else []}
        guardar_datos(DATOS)
    destino = f"las familias de {NOMBRE_GRUPO[grupo]}" if grupo else "toda la escuela"
    texto = f"[SIMULACIÓN · {destino}]\n" + mensaje_aviso(p)
    enviados = await enviar(context, chats_de(grupo), texto)
    log.info("Aviso simulado (%s, %s) enviado a %s chats", p["semaforo"], destino, enviados)
    await update.message.reply_text(f"Aviso simulado enviado a {enviados} familia(s) de {destino}.")


async def responder(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    texto = (update.message.text or "").strip()
    if texto == "1":
        hoy = datetime.now(ZONA_GDL).date().isoformat()
        DATOS["reportes"] = {hoy: DATOS["reportes"].get(hoy, 0) + 1}  # solo se guarda el día de hoy
        guardar_datos(DATOS)
        # TODO: CONECTAR A LA API - cuando exista: POST {API_URL}/reportes-sintomas {"escuela": ESCUELA_ID}
        log.info("Reporte de síntomas recibido (total hoy: %s)", DATOS["reportes"][hoy])
        await update.message.reply_text(
            "Gracias, quedó registrado. La escuela verá cuántos niños tuvieron síntomas hoy, "
            "sin nombres.\n\nSi le cuesta hablar, tiene los labios azulados o no mejora con "
            "su inhalador, llame al 911."
        )
    else:
        await update.message.reply_text(
            "Responda 1 si su hijo o hija tuvo síntomas hoy, o escriba /manana para ver el pronóstico."
        )


# ---------------------------------------------------------------------
# Avisos desde el tablero y la vista de la maestra (API)
# ---------------------------------------------------------------------
# Contrato pedido a Juan (todavía no existe en la API; mientras tanto el bot solo lo anota en el log):
#   GET  {API_URL}/alertas/aviso/pendientes   -> [{"id", "escuela_id", "grupo" (o null), "texto"}]
#   POST {API_URL}/alertas/aviso/{id}/enviado  body {"familias": n}
async def repartir_avisos(context: ContextTypes.DEFAULT_TYPE) -> None:
    estado = context.application.bot_data
    try:
        r = await cliente(context).get(f"{API_URL}/alertas/aviso/pendientes", params={"escuela_id": ESCUELA_ID})
        r.raise_for_status()
        pendientes = r.json()
    except (httpx.HTTPError, ValueError) as e:
        if not estado.get("aviso_api_falla"):  # se anota una sola vez, no cada 30 s
            log.info("Avisos del tablero no disponibles todavía (%s). Se reintenta en silencio.", e)
            estado["aviso_api_falla"] = True
        return
    if estado.pop("aviso_api_falla", False):
        log.info("Avisos del tablero disponibles: el bot ya los reparte.")

    for aviso in pendientes:
        aid = aviso.get("id")
        if aid is None or aid in DATOS["avisos_enviados"]:
            continue  # ya se repartió aunque la API no se haya enterado: no se repite a las familias
        grupo = aviso.get("grupo")
        if grupo is not None and grupo not in NOMBRE_GRUPO:
            log.warning("Aviso %s con grupo desconocido %r; no se envía.", aid, grupo)
            continue
        n = await enviar(context, chats_de(grupo), aviso.get("texto", ""))
        DATOS["avisos_enviados"] = (DATOS["avisos_enviados"] + [aid])[-200:]
        guardar_datos(DATOS)
        log.info("Aviso %s del tablero repartido a %s familia(s) (%s)", aid, n, grupo or "toda la escuela")
        try:
            await cliente(context).post(f"{API_URL}/alertas/aviso/{aid}/enviado", json={"familias": n})
        except httpx.HTTPError as e:
            log.warning("No se pudo marcar el aviso %s como enviado: %s", aid, e)


# ---------------------------------------------------------------------
# Aviso automático diario
# ---------------------------------------------------------------------
NOMBRE_TRABAJO = "aviso-diario"
# TODO: CONECTAR A LA API - cuando exista, leer la hora de GET {API_URL}/alertas/programacion
# (la misma que guarda el tablero). Hoy arranca con HORA_AVISO de bot/.env y se cambia con /hora.
HORA_AVISO = os.getenv("HORA_AVISO", "07:00")


def leer_hora(texto: str) -> time | None:
    """Convierte "7:30" o "07:30" en un time de Guadalajara; None si no es válido."""
    m = re.fullmatch(r"([01]?\d|2[0-3]):([0-5]\d)", texto.strip())
    if not m:
        return None
    return time(int(m.group(1)), int(m.group(2)), tzinfo=ZONA_GDL)


async def enviar_aviso_diario(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Lo llama el JobQueue a la hora programada. Con datos de ejemplo o viejos no se manda nada."""
    p = await obtener_pronostico(context)
    if p["simulado"]:
        log.warning("Aviso diario NO enviado: el pronóstico real no está disponible.")
        return
    enviados = await enviar(context, chats_de(None), mensaje_aviso(p))
    log.info("Aviso diario (%s) enviado a %s familia(s)", p["semaforo"], enviados)


def programar_aviso(job_queue, hora: time) -> None:
    """Quita la programación anterior y deja una sola a la hora indicada."""
    for job in job_queue.get_jobs_by_name(NOMBRE_TRABAJO):
        job.schedule_removal()
    job_queue.run_daily(enviar_aviso_diario, time=hora, name=NOMBRE_TRABAJO)


async def hora(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    global HORA_AVISO
    if context.job_queue is None:
        await update.message.reply_text(
            "El aviso automático no está activo: falta instalar APScheduler (pip install -r requirements.txt)."
        )
        return
    if not context.args:
        await update.message.reply_text(
            f"El aviso automático se envía todos los días a las {HORA_AVISO} (hora de Guadalajara).\n"
            "Para cambiarla escriba, por ejemplo: /hora 06:30"
        )
        return
    nueva = leer_hora(context.args[0])
    if nueva is None:
        await update.message.reply_text("Hora no válida. Use el formato HH:MM, por ejemplo: /hora 06:30")
        return
    programar_aviso(context.job_queue, nueva)
    HORA_AVISO = nueva.strftime("%H:%M")
    log.info("Aviso diario reprogramado a las %s", HORA_AVISO)
    await update.message.reply_text(f"Listo. El aviso automático se enviará todos los días a las {HORA_AVISO}.")


# ---------------------------------------------------------------------
# Arranque
# ---------------------------------------------------------------------
async def al_iniciar(app: Application) -> None:
    app.bot_data["http"] = httpx.AsyncClient(timeout=5)


async def al_cerrar(app: Application) -> None:
    await app.bot_data["http"].aclose()


def main() -> None:
    if not TOKEN:
        raise SystemExit("Falta TELEGRAM_TOKEN. Copie bot/.env.example a bot/.env y ponga el token de @BotFather.")
    app = Application.builder().token(TOKEN).post_init(al_iniciar).post_shutdown(al_cerrar).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("grupos", grupos))
    app.add_handler(CommandHandler("manana", manana))
    app.add_handler(CommandHandler("simular", simular))
    app.add_handler(CommandHandler("hora", hora))
    app.add_handler(CommandHandler("salir", salir))
    app.add_handler(CallbackQueryHandler(elegir_grupo, pattern=r"^g:"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, responder))
    if app.job_queue is None:
        log.warning("Sin APScheduler: no habrá aviso automático ni avisos del tablero. Corra pip install -r requirements.txt")
    else:
        inicial = leer_hora(HORA_AVISO)
        if inicial is None:
            raise SystemExit(f"HORA_AVISO no válida en bot/.env: {HORA_AVISO!r}. Use HH:MM, por ejemplo 07:00.")
        programar_aviso(app.job_queue, inicial)
        app.job_queue.run_repeating(repartir_avisos, interval=INTERVALO_AVISOS, first=5, name="avisos-tablero")
        log.info("Aviso automático diario a las %s (Guadalajara); avisos del tablero cada %s s",
                 HORA_AVISO, INTERVALO_AVISOS)
    log.info("Bot corriendo con %s familia(s) registradas. API: %s. Ctrl+C para detener.",
             len(DATOS["familias"]), API_URL)
    app.run_polling()


if __name__ == "__main__":
    main()
