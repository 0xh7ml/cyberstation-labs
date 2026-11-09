import hashlib
from datetime import datetime
from . import db
from .models import User, Account, Transaction


def md5(password: str) -> str:
    return hashlib.md5(password.encode()).hexdigest()


def seed_db():
    # Users
    alice = User(
        username="alice",
        password_hash=md5("password123"),
        email="alice@securebank.example",
        role="customer",
    )
    bob = User(
        username="bob",
        password_hash=md5("qwerty"),
        email="bob@securebank.example",
        role="customer",
    )
    admin = User(
        username="admin",
        password_hash=md5("admin"),
        email="admin@securebank.example",
        role="admin",
    )

    db.session.add_all([alice, bob, admin])
    db.session.flush()  # get IDs before creating accounts

    # Accounts
    alice_account = Account(
        user_id=alice.id,
        account_number="ACC-1001",
        balance=4200.0,
        account_type="current",
    )
    bob_account = Account(
        user_id=bob.id,
        account_number="ACC-1002",
        balance=12800.0,
        account_type="current",
    )

    db.session.add_all([alice_account, bob_account])
    db.session.flush()

    # Sample transactions — alice -> bob
    # Note: one note contains an XSS payload (A05 Lab 13)
    transactions = [
        Transaction(
            from_account_id=alice_account.id,
            to_account_id=bob_account.id,
            amount=50.0,
            note="Lunch repayment",
            status="completed",
            timestamp=datetime(2024, 11, 1, 10, 0, 0),
        ),
        Transaction(
            from_account_id=alice_account.id,
            to_account_id=bob_account.id,
            amount=12.50,
            # XSS payload stored in note — demonstrates A05 Lab 13
            note='Transfer for <img src=x onerror=alert(1)>coffee',
            status="completed",
            timestamp=datetime(2024, 11, 3, 14, 30, 0),
        ),
        Transaction(
            from_account_id=alice_account.id,
            to_account_id=bob_account.id,
            amount=200.0,
            note="Rent share November",
            status="completed",
            timestamp=datetime(2024, 11, 5, 9, 15, 0),
        ),
    ]

    db.session.add_all(transactions)
    db.session.commit()
    print("[seed] Database seeded with alice, bob, admin and sample transactions.")
