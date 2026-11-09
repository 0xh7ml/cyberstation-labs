import os
import pickle

import jwt
from flask import Blueprint, request, jsonify, send_from_directory

from .. import db
from ..models import User

integrity_bp = Blueprint("integrity", __name__, url_prefix="/integrity")

SECRET_KEY = os.environ.get("SECRET_KEY", "secret")
UPLOAD_DIR = "/app/uploads"


def _get_current_user():
    """Decode JWT from Authorization header. Returns User or None."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256", "none"])
        return User.query.get(payload["user_id"])
    except Exception:
        return None


# ---------------------------------------------------------------------------
# A08 Lab 20 — Pickle deserialization RCE
# ---------------------------------------------------------------------------
@integrity_bp.route("/import-account", methods=["POST"])
def import_account():
    if "data" not in request.files:
        return jsonify({"error": "No file uploaded — use multipart field 'data'"}), 400

    file = request.files["data"]
    raw_bytes = file.read()

    # Intentionally vulnerable — no validation before pickle.loads (A08 Lab 20)
    # An attacker can craft a malicious pickle that executes arbitrary OS commands
    obj = pickle.loads(raw_bytes)

    return jsonify({
        "message": "Account data imported",
        "object": str(obj),
        "note": "Deserialized via pickle.loads() with no validation — A08 Lab 20",
    })


# ---------------------------------------------------------------------------
# A08 Lab 21 — JWT signature verification disabled
# ---------------------------------------------------------------------------
@integrity_bp.route("/verify-token", methods=["GET"])
def verify_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing token"}), 401

    token = auth_header.split(" ", 1)[1]

    # Intentionally bypasses signature check — A08 Lab 21
    # options={"verify_signature": False} means any payload is accepted
    payload = jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256", "none"])

    return jsonify({
        "payload": payload,
        "verified": False,
        "note": "Signature NOT verified — A08 Lab 21. Any JWT payload is accepted.",
    })


# ---------------------------------------------------------------------------
# A08 Lab 22 — Unverified file upload (no MIME/extension check)
# ---------------------------------------------------------------------------
@integrity_bp.route("/kyc-upload", methods=["POST"])
def kyc_upload():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded — use multipart field 'file'"}), 400

    file = request.files["file"]
    # Intentionally uses original filename with no sanitisation or extension check — A08 Lab 22
    filename = file.filename

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    save_path = os.path.join(UPLOAD_DIR, filename)
    file.save(save_path)

    return jsonify({
        "message": "File uploaded",
        "filename": filename,
        "url": f"/uploads/{filename}",
        "note": "No MIME type or extension validation — A08 Lab 22",
    })


@integrity_bp.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    # Serves any uploaded file directly — allows serving a PHP/Python shell, etc.
    # Route accessible at /integrity/uploads/<filename>
    return send_from_directory(UPLOAD_DIR, filename)
