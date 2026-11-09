import os

import jwt
from flask import Blueprint, request, jsonify, render_template_string
from sqlalchemy import text

from .. import db
from ..models import Account, Transaction

transfers_bp = Blueprint("transfers", __name__, url_prefix="/transfers")

SECRET_KEY = os.environ.get("SECRET_KEY", "secret")


# ---------------------------------------------------------------------------
# A05 Lab 10 — SQL Injection in search
# ---------------------------------------------------------------------------
@transfers_bp.route("/search", methods=["GET"])
def search_transfers():
    q = request.args.get("q", "")

    # Intentionally vulnerable raw SQL — SQLi (A05 Lab 10)
    sql = f"SELECT * FROM transactions WHERE note LIKE '%{q}%'"
    result = db.session.execute(text(sql))
    rows = result.fetchall()

    transactions = []
    for row in rows:
        transactions.append({
            "id": row[0],
            "from_account_id": row[1],
            "to_account_id": row[2],
            "amount": row[3],
            "note": row[4],
            "timestamp": str(row[5]),
            "status": row[6],
        })

    return jsonify({"results": transactions, "query": q})


# ---------------------------------------------------------------------------
# A05 Lab 11 — Server-Side Template Injection (SSTI)
# ---------------------------------------------------------------------------
@transfers_bp.route("/<int:txn_id>/remark", methods=["POST"])
def add_remark(txn_id):
    data = request.get_json(force=True) or {}
    remark = data.get("remark", "")

    txn = Transaction.query.get(txn_id)
    if txn is None:
        return jsonify({"error": "Transaction not found"}), 404

    # Intentionally vulnerable SSTI — user input embedded directly in template string
    # e.g. remark = "{{7*7}}" or "{{config}}" or "{{''.__class__.__mro__[1].__subclasses__()}}"
    rendered = render_template_string(f"<p>Remark: {remark}</p>")

    txn.note = remark
    db.session.commit()

    return jsonify({"rendered": rendered, "txn_id": txn_id})


# ---------------------------------------------------------------------------
# A10 Lab 24 — TypeError info disclosure: no try/except around float()
# ---------------------------------------------------------------------------
@transfers_bp.route("/send", methods=["POST"])
def send_transfer():
    data = request.get_json(force=True) or {}
    from_account_id = data.get("from_account_id")
    to_account_id = data.get("to_account_id")
    amount_raw = data.get("amount")

    # Intentionally no try/except — A10 Lab 24
    # Passing a non-numeric amount causes TypeError with internal variable info
    amount = float(amount_raw)

    from_account = Account.query.get(from_account_id)
    to_account = Account.query.get(to_account_id)

    if from_account is None or to_account is None:
        return jsonify({"error": "Account not found"}), 404

    if from_account.balance < amount:
        return jsonify({"error": "Insufficient funds"}), 400

    from_account.balance -= amount
    to_account.balance += amount

    txn = Transaction(
        from_account_id=from_account_id,
        to_account_id=to_account_id,
        amount=amount,
        note=data.get("note", ""),
        status="completed",
    )
    db.session.add(txn)
    db.session.commit()

    return jsonify({
        "message": "Transfer complete",
        "transaction_id": txn.id,
        "amount": amount,
    })


# ---------------------------------------------------------------------------
# A10 Lab 25 — Insecure fallback: bare except defaults to admin user
# ---------------------------------------------------------------------------
@transfers_bp.route("/history", methods=["GET"])
def transfer_history():
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.split(" ", 1)[1] if " " in auth_header else ""

    # Intentionally vulnerable — bare except defaults to admin (user id=1)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload["user_id"]
    except:  # noqa: E722
        user_id = 1  # falls back to admin (id=1)

    accounts = Account.query.filter_by(user_id=user_id).all()
    account_ids = [a.id for a in accounts]

    transactions = Transaction.query.filter(
        Transaction.from_account_id.in_(account_ids) |
        Transaction.to_account_id.in_(account_ids)
    ).all()

    return jsonify({
        "user_id": user_id,
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
# A10 Lab 23 — Verbose error: unhandled ValueError from int() conversion
# ---------------------------------------------------------------------------
@transfers_bp.route("/account-summary", methods=["GET"])
def account_summary():
    id_raw = request.args.get("id", "")

    # Intentionally no try/except — raises ValueError with full traceback on bad input
    account_id = int(id_raw)

    account = Account.query.get(account_id)
    if account is None:
        return jsonify({"error": "Account not found"}), 404

    return jsonify({
        "id": account.id,
        "account_number": account.account_number,
        "balance": account.balance,
        "account_type": account.account_type,
    })
