from datetime import datetime
from . import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    # Intentionally weak: MD5 hash — A04 Lab 7
    password_hash = db.Column(db.String(32), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False, default="customer")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    accounts = db.relationship("Account", backref="owner", lazy=True)
    reset_tokens = db.relationship("PasswordResetToken", backref="user", lazy=True)


class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    account_number = db.Column(db.String(20), unique=True, nullable=False)
    balance = db.Column(db.Float, nullable=False, default=0.0)
    account_type = db.Column(db.String(20), nullable=False, default="current")

    transactions_sent = db.relationship(
        "Transaction", foreign_keys="Transaction.from_account_id", backref="sender", lazy=True
    )
    transactions_received = db.relationship(
        "Transaction", foreign_keys="Transaction.to_account_id", backref="receiver", lazy=True
    )


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    from_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    to_account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    # note stores XSS payload — A05 Lab 13
    note = db.Column(db.String(500), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), nullable=False, default="completed")


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False)
    # No expiry field — A07 Lab 19
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
