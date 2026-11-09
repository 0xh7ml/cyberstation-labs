import logging
import os

import jwt
from flask import Blueprint, request, jsonify

from .. import db
from ..models import User, Account

crypto_bp = Blueprint("crypto", __name__, url_prefix="/crypto")

SECRET_KEY = os.environ.get("SECRET_KEY", "secret")
logger = logging.getLogger(__name__)


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
# A04 Lab 7 — MD5 password hashes exposed (admin JWT required, no role check)
# ---------------------------------------------------------------------------
@crypto_bp.route("/hashes", methods=["GET"])
def get_hashes():
    current_user = _get_current_user()
    if current_user is None:
        return jsonify({"error": "Unauthorized"}), 401

    # Intentionally missing: no role check — any authenticated user can retrieve hashes
    users = User.query.all()
    return jsonify({
        "note": "MD5 hashes — intentionally weak (A04 Lab 7). Crack with: hashcat -m 0",
        "hashes": [
            {
                "id": u.id,
                "username": u.username,
                "password_hash": u.password_hash,
                "algorithm": "MD5",
            }
            for u in users
        ],
    })


# ---------------------------------------------------------------------------
# A04 Lab 8 — Hardcoded JWT secret ("secret"), logged to stdout
# ---------------------------------------------------------------------------
@crypto_bp.route("/token", methods=["POST"])
def issue_token():
    data = request.get_json(force=True) or {}
    username = data.get("username", "anonymous")

    # Intentionally uses the hardcoded/weak SECRET_KEY — A04 Lab 8
    payload = {"username": username, "scope": "demo"}
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    # Log secret to stdout — A04 Lab 8
    print(f"[crypto/token] Signing with SECRET_KEY={SECRET_KEY}")
    logger.warning("Issued token using SECRET_KEY=%s", SECRET_KEY)

    return jsonify({
        "token": token,
        "secret_used": SECRET_KEY,  # deliberately disclosed
        "note": "Secret is hardcoded as 'secret' — A04 Lab 8",
    })


# ---------------------------------------------------------------------------
# A04 Lab 9 — PII in cleartext JSON response and logged to stdout
# ---------------------------------------------------------------------------
@crypto_bp.route("/profile", methods=["GET"])
def get_profile():
    current_user = _get_current_user()
    if current_user is None:
        return jsonify({"error": "Unauthorized"}), 401

    account = Account.query.filter_by(user_id=current_user.id).first()

    # Full PII including sort code and balance — in plaintext JSON (A04 Lab 9)
    profile = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "account_number": account.account_number if account else None,
        "sort_code": "20-00-00",
        "balance": account.balance if account else None,
        "password_hash": current_user.password_hash,  # deliberately exposed
    }

    # Log full profile to stdout — A04 Lab 9
    logger.warning("Full profile returned in cleartext: %s", profile)
    print(f"[crypto/profile] PII response: {profile}")

    return jsonify(profile)
