# SecureBank Labs — Architecture Plan

> Developer Security Training · OWASP Top 10 (2025) · 25 Hands-On Labs  
> Internet Banking Web Application

---

## Overview

| Item | Detail |
|------|--------|
| Total Labs | 25 (3 per category, A05 has 4) |
| OWASP Categories | 8 (A01, A02, A04, A05, A06, A07, A08, A10) |
| Backend Services | Flask · Django · Go Echo |
| Frontend | Vite + React + Bootstrap AdminLTE |
| Deployment | Docker Compose (local) |
| User Roles | Customer · Admin |
| Lab UX | Exploit Steps / Affected Code / Hint / Fix+Diff tabs |

---

## Service Architecture

| Service | Stack | Port | Covers |
|---------|-------|------|--------|
| Frontend | Vite · React · Bootstrap AdminLTE | :3000 | Lab panel · Banking UI · XSS demo |
| Flask App | Python 3.12 · Flask · SQLAlchemy · SQLite | :5000 | A01 · A04 · A05 · A07 · A08 · A10 |
| Django App | Python 3.12 · Django 5 · DRF · SQLite | :8000 | A02 · A06 |
| Go Report Svc | Go 1.23 · Echo Framework | :8080 | A05 — SSTI + OS Cmd (Go) |
| Nginx | nginx:alpine | :80 | Reverse proxy for all services |

**Routing:** Nginx proxies `/api/flask/*` → 5000, `/api/django/*` → 8000, `/api/report/*` → 8080.

---

## Seed Accounts

| User | Password | Account | Role |
|------|----------|---------|------|
| alice | password123 | #1001 — £4,200.00 | customer |
| bob | qwerty | #1002 — £12,800.00 | customer |
| admin | admin | — | admin |

---

## Lab Catalog

### A01 — Broken Access Control (Flask)

**Lab 1 — IDOR: View Another Customer's Account** `Low`
- `/api/accounts/{id}` returns data without ownership check
- Change account ID in URL to access another customer's balance + transactions
- Tags: `IDOR` `GET param`

**Lab 2 — Privilege Escalation: Customer → Admin Dashboard** `Medium`
- Admin routes protected only by frontend redirect, no server-side role check
- Call `/api/admin/users` directly as a logged-in customer
- Tags: `Broken AuthZ` `Role bypass`

**Lab 3 — SSRF: Internal Metadata Fetch via PDF Statement** `High`
- "Email my statement" accepts a callback URL and fetches it server-side without validation
- Point at `http://169.254.169.254/latest/meta-data/` or internal service
- Tags: `SSRF` `requests.get`

---

### A02 — Security Misconfiguration (Django)

**Lab 4 — Debug Mode: Stack Trace Exposes DB Credentials** `Low`
- `DEBUG=True` in Django settings — any unhandled exception returns full stack trace
- Exposes `settings.py` values, database DSN, and secret key in browser
- Tags: `DEBUG=True` `Info disclosure`

**Lab 5 — Default Django Admin Credentials** `Low`
- `/admin/` panel enabled with default superuser `admin:admin`
- Full ORM-backed admin access to all users, accounts, transactions
- Tags: `Default creds` `/admin/`

**Lab 6 — Sensitive File Exposure: .env, .git, backup.zip** `Medium`
- Static file serving misconfigured — navigate to `/.env`, `/.git/config`, `/backup.zip`
- Downloads env vars, git history, and full database backup
- Tags: `STATIC_ROOT` `File exposure`

---

### A04 — Cryptographic Failures (Flask)

**Lab 7 — MD5 Password Hashing: Crack with Hashcat** `Medium`
- Passwords stored as unsalted MD5 hashes
- Extract hashes, crack with `hashcat -m 0` and standard wordlist
- Tags: `MD5` `hashlib` `Hashcat`

**Lab 8 — Hardcoded Weak JWT Secret: Forge Admin Token** `Medium`
- JWT signed with hardcoded secret `"secret"` visible in source
- Forge token with `{"role":"admin"}` using `jwt.io` or PyJWT
- Tags: `JWT` `Hardcoded secret`

**Lab 9 — Cleartext PII in API Response and Logs** `Low`
- `/api/transfers` returns full account numbers, sort codes, PII in plaintext
- Also logs to stdout — visible in `docker logs` with no masking
- Tags: `Cleartext` `PII in logs`

---

### A05 — Injection (Flask · Go Echo · React)

**Lab 10 — SQL Injection: Login Bypass & Data Dump** `High`
- Login form passes username into raw SQL query
- Payload: `' OR '1'='1` for bypass; `sqlmap` to dump all tables
- Tags: `SQLite` `Raw query` `sqlmap`

**Lab 11 — SSTI: Jinja2 RCE via Transaction Remark Field** `High`
- "Add remark" feature uses `render_template_string()` with user input
- `{{7*7}}` confirms SSTI; escalate to `{{''.__class__.__mro__[1].__subclasses__()}}` for RCE
- Tags: `Jinja2` `SSTI` `RCE`

**Lab 12 — SSTI + OS Command Injection: Go Echo Report Service** `High`
- Go microservice renders HTML from user-supplied template using `text/template` (not `html/template`)
- Also passes date param to `exec.Command("date", input)` without sanitisation — inject `; id`
- Tags: `Go Echo` `text/template` `exec.Command` `RCE`

**Lab 13 — Stored XSS: Transaction Notes in React Frontend** `Medium`
- Notes rendered via `dangerouslySetInnerHTML` without sanitisation
- Submit `<img src=x onerror="alert('XSS')">` — popup fires for every user viewing transactions
- Tags: `React` `dangerouslySetInnerHTML` `Stored XSS`

---

### A06 — Insecure Design (Django)

**Lab 14 — Business Logic: Negative Transfer Amount** `Medium`
- Transfer endpoint validates balance but doesn't reject negative amounts
- POST `{"amount": -500}` to increase own balance while reducing recipient's
- Tags: `Business logic` `Missing validation`

**Lab 15 — Mass Assignment: Self-Promote to Admin** `Medium`
- Profile update passes full request body to `serializer.save()` without field filtering
- POST `{"name":"...", "role":"admin"}` to promote own account
- Tags: `Django DRF` `Mass assignment` `ModelSerializer`

**Lab 16 — Account Enumeration via Login Error Messages** `Low`
- Distinct errors: "User not found" vs "Incorrect password" with no rate limiting
- Script to enumerate valid usernames, then brute-force found accounts
- Tags: `Enumeration` `No rate limit`

---

### A07 — Authentication Failures (Flask)

**Lab 17 — Brute-Force Login: No Rate Limiting or Lockout** `Low`
- `/api/login` has no lockout, CAPTCHA, or rate limiting
- Use `hydra` or Python script with `rockyou.txt` to brute-force demo account
- Tags: `Brute-force` `Hydra` `No lockout`

**Lab 18 — Session Fixation: Fix Session Before Login** `Medium`
- App does not regenerate session ID after login
- Set known `session` cookie before auth — after victim logs in, hijack their session
- Tags: `Session fixation` `session.regenerate`

**Lab 19 — Insecure Password Reset: Predictable Token** `High`
- Reset token generated as `md5(username + timestamp)`
- Compute token offline knowing username + approximate time — reset any user's password
- Tags: `Weak token` `MD5(user+time)` `No expiry`

---

### A08 — Software & Data Integrity Failures (Flask)

**Lab 20 — Insecure Deserialization: Pickle RCE via Account Import** `High`
- "Import account data" uses `pickle.loads()` on user-uploaded files
- Craft malicious pickle payload executing `os.system("id")` — full RCE
- Tags: `pickle.loads` `File upload` `RCE`

**Lab 21 — JWT Algorithm Confusion: alg:none Bypass** `Medium`
- JWT library accepts the `none` algorithm
- Strip signature, change `"alg":"HS256"` → `"alg":"none"` and `"role":"customer"` → `"role":"admin"`
- Tags: `JWT alg:none` `PyJWT`

**Lab 22 — Unverified File Upload: KYC Document Upload** `High`
- KYC upload accepts any file type, stores in web-accessible directory
- Upload a web shell, access via URL to execute arbitrary commands
- Tags: `File upload` `Web shell` `No MIME check`

---

### A10 — Mishandling of Exceptional Conditions (Flask) — NEW

**Lab 23 — Verbose Error Page: Stack Trace with Config Values** `Low`
- Pass non-integer account ID (`?id=abc`) to trigger unhandled `ValueError`
- JSON response includes database path, secret key, installed package versions
- Tags: `Unhandled exception` `Stack trace` `Info disclosure`

**Lab 24 — Error-Based Info Disclosure: Type Coercion on Transfer** `Medium`
- String passed as amount triggers `TypeError` with no handler
- Exception message leaks internal variable name, type, ORM query string
- Tags: `TypeError leak` `ORM query exposure`

**Lab 25 — Insecure Fallback: Auth Bypass on Exception** `High`
- JWT decode step wrapped in bare `except: pass` — defaults `current_user` to admin on any failure
- Send malformed token to trigger exception and get admin access as fallback
- Tags: `except: pass` `Insecure fallback` `Auth bypass`

---

## Project File Structure

```
securebank-labs/
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── flask-app/                    # A01, A04, A05, A07, A08, A10
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── models.py
│       ├── seed.py
│       ├── blueprints/
│       │   ├── auth.py           # A07: login, session, password reset
│       │   ├── accounts.py       # A01: IDOR, SSRF, privesc
│       │   ├── transfers.py      # A05: SQLi; A10: exceptions
│       │   ├── crypto.py         # A04: hashing, JWT, cleartext
│       │   └── integrity.py      # A08: pickle, JWT none, file upload
│       └── templates/
│           └── statement.html    # A05 Lab 11: SSTI target template
├── django-app/                   # A02, A06
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── manage.py
│   └── banking/
│       ├── settings/
│       │   ├── dev.py            # Intentionally misconfigured (DEBUG, ALLOWED_HOSTS)
│       │   └── secure.py         # Fixed reference config (shown in Fix tab)
│       ├── apps/
│       │   ├── accounts/         # A02: admin, debug, file exposure
│       │   └── transfers/        # A06: logic flaws, mass assignment, enumeration
│       └── static/               # A02 Lab 06: exposed .env, backup.zip
├── go-report-svc/                # A05 Lab 12: SSTI + OS Cmd in Go Echo
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   └── main.go
└── frontend/                     # Vite + React + Bootstrap AdminLTE
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── Sidebar.tsx        # AdminLTE nav with lab tree
        │   ├── LabPanel.tsx       # Tabs: Steps / Code / Hint / Fix
        │   └── Banking/           # Login, Dashboard, Accounts, Transfers
        └── pages/
            ├── labs/              # One .tsx per lab (25 files)
            └── banking/           # Actual banking feature pages
```

---

## docker-compose.yml Sketch

```yaml
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    depends_on: [flask-app, django-app, go-report-svc, frontend]

  frontend:
    build: ./frontend
    expose: ["3000"]

  flask-app:
    build: ./flask-app
    expose: ["5000"]
    environment:
      - FLASK_ENV=development
      - SECRET_KEY=secret        # intentionally weak for A04 Lab 08

  django-app:
    build: ./django-app
    expose: ["8000"]
    environment:
      - DJANGO_SETTINGS_MODULE=banking.settings.dev   # misconfigured

  go-report-svc:
    build: ./go-report-svc
    expose: ["8080"]
```

**Quickstart:** `git clone … && docker compose up --build` then open `http://localhost`.  
Seed data (alice, bob, admin + sample transactions) is loaded automatically on first boot.

---

## Lab Panel UX

Each lab page has four tabs:

| Tab | Content |
|-----|---------|
| **Exploit Steps** | Numbered walkthrough with curl/browser commands |
| **Affected Code** | Syntax-highlighted vulnerable snippet + "Copy Markdown" export button |
| **Hint** | Collapsible — reveals what to look for without giving it away |
| **Fix / Diff** | Collapsible before/after code diff + explanation of fix principle |

---

## Difficulty Summary

| Difficulty | Labs |
|-----------|------|
| Low | 1, 4, 5, 9, 16, 17, 23 |
| Medium | 2, 6, 7, 8, 13, 14, 15, 18, 21, 24 |
| High | 3, 10, 11, 12, 19, 20, 22, 25 |
