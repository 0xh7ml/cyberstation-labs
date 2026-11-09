"""
Secure settings — reference implementation shown in the "Fix" tab of A02 labs.

This is what a hardened production configuration looks like.
Compare with dev.py to understand each vulnerability and its remediation.
"""
import os

# A02 Fix: Secret key loaded from environment, never hardcoded
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ValueError('DJANGO_SECRET_KEY environment variable must be set')

# A02 Lab 4 Fix: DEBUG=False — no stack traces or variable dumps exposed to users
DEBUG = False

# A02 Fix: Restrict to known hosts only
ALLOWED_HOSTS = ['localhost', '127.0.0.1']

INSTALLED_APPS = [
    # A02 Lab 5 Fix: Admin removed from production deployment
    # 'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'banking',
    'banking.apps.accounts',
    'banking.apps.transfers',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'banking.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# A02 Fix: Use a proper database with credentials from environment
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'banking'),
        'USER': os.environ.get('DB_USER', 'banking'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

AUTH_USER_MODEL = 'accounts.BankUser'

# A02 Lab 6 Fix: STATIC_ROOT is an isolated directory outside the project tree,
# not serving sensitive files like .env or database backups
STATIC_URL = '/static/'
STATIC_ROOT = '/var/www/securebank/static/'   # Isolated, not inside /app/
# STATICFILES_DIRS does NOT include any directory containing .env or database files

# Security headers
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'

# DRF: enforce JWT auth and permissions on all endpoints
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    # A06 Lab 16 Fix: rate limiting on all endpoints
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',
        'user': '100/minute',
    },
}

# A06 Lab 15 Fix: Never expose writable role field — use separate admin-only endpoint
# A06 Lab 16 Fix: Use distinct error messages only internally; return generic errors to client
# A06 Lab 14 Fix: Always validate amount > 0 server-side

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
