import hashlib
import time
import os

import jwt
from flask import Blueprint, request, jsonify, session
from sqlalchemy import text

from .. import db
from ..models import User, PasswordResetToken

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

SECRET_KEY = os.environ.get("SECRET_KEY", "secret")


def _make_jwt(user):
    payload = {
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


# ---------------------------------------------------------------------------
# A07 Lab 17 — Brute-force: no rate limiting, no lockout
# A05 Lab 10 — SQL Injection: raw SQL with string interpolation
# ---------------------------------------------------------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    # MD5 the supplied password to compare against stored hash
    password_md5 = hashlib.md5(password.encode()).hexdigest()

    # Intentionally vulnerable raw SQL — SQLi vector (A05) + no rate limit (A07 Lab 17)
    sql = f"SELECT * FROM users WHERE username='{username}' AND password_hash='{password_md5}'"
    result = db.session.execute(text(sql))
    row = result.fetchone()

    if row is None:
        return jsonify({"error": "Invalid credentials"}), 401

    user = User.query.get(row[0])
    token = _make_jwt(user)
    return jsonify({"token": token, "user_id": user.id, "role": user.role})


# ---------------------------------------------------------------------------
# A07 Lab 18 — Session fixation: session ID not regenerated on login
# ---------------------------------------------------------------------------
@auth_bp.route("/login-session", methods=["POST"])
def login_session():
    data = request.get_json(force=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")

    password_md5 = hashlib.md5(password.encode()).hexdigest()
    user = User.query.filter_by(username=username, password_hash=password_md5).first()

    if user is None:
        return jsonify({"error": "Invalid credentials"}), 401

    # Vulnerable: session ID is NOT regenerated before writing the user identity
    # An attacker who fixed the session ID before login now has an authenticated session
    session["user_id"] = user.id
    session["username"] = user.username
    session["role"] = user.role

    return jsonify({"message": "Logged in", "session_user": user.username})


# ---------------------------------------------------------------------------
# A07 Lab 18 — Logout: clears session but does not invalidate the old session ID
# ---------------------------------------------------------------------------
@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    # Intentionally omits session.modified = True and does not call session.regenerate()
    return jsonify({"message": "Logged out"})


# ---------------------------------------------------------------------------
# A07 Lab 19 — Predictable reset token (MD5 of username+epoch), no expiry
# ---------------------------------------------------------------------------
@auth_bp.route("/reset-request", methods=["POST"])
def reset_request():
    data = request.get_json(force=True) or {}
    username = data.get("username", "")

    user = User.query.filter_by(username=username).first()
    if user is None:
        return jsonify({"error": "User not found"}), 404

    # Intentionally predictable: MD5(username + current unix timestamp)
    raw = username + str(int(time.time()))
    token = hashlib.md5(raw.encode()).hexdigest()

    reset_token = PasswordResetToken(user_id=user.id, token=token)
    db.session.add(reset_token)
    db.session.commit()

    # Token returned in response body — for lab convenience and to demonstrate the exposure
    return jsonify({"message": "Reset token generated", "token": token})


@auth_bp.route("/reset-confirm", methods=["POST"])
def reset_confirm():
    data = request.get_json(force=True) or {}
    token = data.get("token", "")
    new_password = data.get("new_password", "")

    # No expiry check — A07 Lab 19
    reset_token = PasswordResetToken.query.filter_by(token=token).first()
    if reset_token is None:
        return jsonify({"error": "Invalid token"}), 400

    user = User.query.get(reset_token.user_id)
    user.password_hash = hashlib.md5(new_password.encode()).hexdigest()
    db.session.delete(reset_token)
    db.session.commit()

    return jsonify({"message": "Password reset successfully"})


# ---------------------------------------------------------------------------
# A08 Lab 21 — JWT alg:none accepted
# ---------------------------------------------------------------------------
@auth_bp.route("/me", methods=["GET"])
def me():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing token"}), 401

    token = auth_header.split(" ", 1)[1]

    # Intentionally accepts alg="none" — A08 Lab 21
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256", "none"])
    user = User.query.get(payload["user_id"])
    if user is None:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
    })
