import os

import jwt
import requests
from flask import Blueprint, request, jsonify

from .. import db
from ..models import User, Account, Transaction

accounts_bp = Blueprint("accounts", __name__)

SECRET_KEY = os.environ.get("SECRET_KEY", "secret")


def _get_current_user():
    """Decode JWT from Authorization header. Returns User or None."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        if jwt.get_unverified_header(token).get("alg", "").lower() == "none":
            payload = jwt.decode(token, options={"verify_signature": False})
        else:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return User.query.get(payload["user_id"])
    except Exception:
        return None


# ---------------------------------------------------------------------------
# List current user's accounts (dashboard endpoint)
# ---------------------------------------------------------------------------
@accounts_bp.route("/accounts", methods=["GET"])
def list_accounts():
    current_user = _get_current_user()
    if current_user is None:
        return jsonify({"error": "Unauthorized"}), 401

    accounts = Account.query.filter_by(user_id=current_user.id).all()
    return jsonify([
        {
            "id": a.id,
            "account_number": a.account_number,
            "balance": a.balance,
            "account_type": a.account_type,
            "user_id": a.user_id,
        }
        for a in accounts
    ])


# ---------------------------------------------------------------------------
# A01 Lab 1 — IDOR: no ownership check on account lookup
# ---------------------------------------------------------------------------
@accounts_bp.route("/accounts/<int:account_id>", methods=["GET"])
def get_account(account_id):
    current_user = _get_current_user()
    if current_user is None:
        return jsonify({"error": "Unauthorized"}), 401

    # Intentionally missing: no check that account.user_id == current_user.id
    account = Account.query.get(account_id)
    if account is None:
        return jsonify({"error": "Account not found"}), 404

    transactions = Transaction.query.filter(
        (Transaction.from_account_id == account.id) |
        (Transaction.to_account_id == account.id)
    ).all()

    return jsonify({
        "id": account.id,
        "account_number": account.account_number,
        "balance": account.balance,
        "account_type": account.account_type,
        "user_id": account.user_id,
        "transactions": [
            {
                "id": t.id,
                "from_account_id": t.from_account_id,
                "to_account_id": t.to_account_id,
                "amount": t.amount,
                "note": t.note,
                "timestamp": t.timestamp.isoformat(),
                "status": t.status,
            }
            for t in transactions
        ],
    })


# ---------------------------------------------------------------------------
# A01 Lab 2 — Privilege escalation: JWT required but role NOT checked
# ---------------------------------------------------------------------------
@accounts_bp.route("/admin/users", methods=["GET"])
def admin_list_users():
    current_user = _get_current_user()
    if current_user is None:
        return jsonify({"error": "Unauthorized"}), 401

    # Intentionally missing: no check that current_user.role == "admin"
    users = User.query.all()
    return jsonify([
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "password_hash": u.password_hash,  # deliberately exposed
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ])


@accounts_bp.route("/admin/accounts", methods=["GET"])
def admin_list_accounts():
    current_user = _get_current_user()
    if current_user is None:
        return jsonify({"error": "Unauthorized"}), 401

    # Intentionally missing: no role check
    accounts = Account.query.all()
    return jsonify([
        {
            "id": a.id,
            "account_number": a.account_number,
            "balance": a.balance,
            "account_type": a.account_type,
            "user_id": a.user_id,
        }
        for a in accounts
    ])


# ---------------------------------------------------------------------------
# A01 Lab 3 — SSRF: callback_url passed directly to requests.get()
# ---------------------------------------------------------------------------
@accounts_bp.route("/accounts/statement-email", methods=["POST"])
def statement_email():
    current_user = _get_current_user()
    if current_user is None:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(force=True) or {}
    account_id = data.get("account_id")
    callback_url = data.get("callback_url", "")

    # Intentionally no URL validation — SSRF vector (A01 Lab 3)
    # An attacker can use http://169.254.169.254/latest/meta-data/ or internal hosts
    response = requests.get(callback_url, timeout=5)

    return jsonify({
        "account_id": account_id,
        "callback_url": callback_url,
        "status_code": response.status_code,
        "response_body": response.text,
    })
