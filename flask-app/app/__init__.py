import os
import logging
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy

UPLOAD_DIR = "/app/uploads"

db = SQLAlchemy()

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)

    # Intentionally weak default secret — A04 Lab 8
    secret_key = os.environ.get("SECRET_KEY", "secret")
    app.config["SECRET_KEY"] = secret_key
    # Log the secret to stdout on startup — A04 Lab 8
    print(f"[startup] SECRET_KEY={secret_key}")
    logger.warning("SECRET_KEY=%s", secret_key)

    database_url = os.environ.get("DATABASE_URL", "sqlite:////app/data/securebank.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Do NOT set PROPAGATE_EXCEPTIONS = False — let tracebacks bubble up (A10 Lab 23)

    db.init_app(app)

    with app.app_context():
        from .models import User, Account, Transaction, PasswordResetToken  # noqa: F401

        db.create_all()

        # Seed only if no users exist
        if User.query.count() == 0:
            from .seed import seed_db
            seed_db()

    # Register blueprints
    from .blueprints.auth import auth_bp
    from .blueprints.accounts import accounts_bp
    from .blueprints.transfers import transfers_bp
    from .blueprints.crypto import crypto_bp
    from .blueprints.integrity import integrity_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(accounts_bp)
    app.register_blueprint(transfers_bp)
    app.register_blueprint(crypto_bp)
    app.register_blueprint(integrity_bp)

    # CORS: allow all origins on every response
    @app.after_request
    def add_cors(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

    @app.route("/health")
    def health():
        return {"status": "ok"}

    # Top-level uploads route so /uploads/<filename> matches the URL returned by kyc-upload
    @app.route("/uploads/<path:filename>")
    def serve_upload_root(filename):
        return send_from_directory(UPLOAD_DIR, filename)

    return app


# Allow `flask --app app run` to discover the application
app = create_app()
