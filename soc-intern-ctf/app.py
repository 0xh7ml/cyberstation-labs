#!/usr/bin/env python3
"""Serve the FinSecure SOC challenge as a static single-page app."""
from pathlib import Path

from flask import Flask, render_template, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"

app = Flask(__name__, template_folder=TEMPLATES_DIR)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/<path:filename>")
def template_files(filename):
    return send_from_directory(TEMPLATES_DIR, filename)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8888)
