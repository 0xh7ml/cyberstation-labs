import os

# A02: Cryptographic Failures — intentionally weak/hardcoded secret key
SECRET_KEY = 'django-insecure-training-key-do-not-use'

# A02 Lab 4 — DEBUG=True exposes full stack traces with local variable values
DEBUG = True

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',           # A02 Lab 5 — admin panel enabled
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'banking',                        # project package — hosts management commands
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

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': '/app/data/django.db',
    }
}

AUTH_USER_MODEL = 'accounts.BankUser'

# STATIC_URL must differ from MEDIA_URL (default '').
# Sensitive file exposure for A02 Lab 6 is handled via explicit URL routes in
# urls.py (serve_env_file, serve_backup_zip, serve_git_config) — not staticfiles.
STATIC_URL = '/static/'

# DRF: no global auth or permission enforcement — each view handles its own (or doesn't)
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [],
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
