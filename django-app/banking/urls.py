import os
from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse, FileResponse, Http404


def serve_env_file(request):
    """A02 Lab 6 — .env file exposed via web server misconfiguration."""
    env_path = '/app/static/.env'
    try:
        with open(env_path, 'r') as f:
            content = f.read()
        return HttpResponse(content, content_type='text/plain')
    except FileNotFoundError:
        raise Http404('.env not found')


def serve_git_config(request):
    """A02 Lab 6 — .git/config exposed via web server misconfiguration."""
    # Try actual git config first, fall back to a fake one for lab realism
    git_config_path = '/app/.git/config'
    try:
        with open(git_config_path, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        content = (
            '[core]\n'
            '\trepositoryformatversion = 0\n'
            '\tfilemode = false\n'
            '\tbare = false\n'
            '[remote "origin"]\n'
            '\turl = https://git.internal.securebank.com/securebank/banking-app.git\n'
            '\tfetch = +refs/heads/*:refs/remotes/origin/*\n'
            '[branch "main"]\n'
            '\tremote = origin\n'
            '\tmerge = refs/heads/main\n'
        )
    return HttpResponse(content, content_type='text/plain')


def serve_backup_zip(request):
    """A02 Lab 6 — database backup zip exposed via web server misconfiguration."""
    zip_path = '/app/static/backup.zip'
    try:
        response = FileResponse(open(zip_path, 'rb'), content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename="backup.zip"'
        return response
    except FileNotFoundError:
        raise Http404('backup.zip not found')


urlpatterns = [
    # A02 Lab 5 — Django admin enabled with default credentials
    path('admin/', admin.site.urls),

    # Accounts API: login, profile, debug
    path('api/accounts/', include('banking.apps.accounts.urls')),

    # Transfers API
    path('api/transfers/', include('banking.apps.transfers.urls')),

    # Auth alias used by some lab exercises
    path('api/auth/', include('banking.apps.accounts.urls')),

    # A02 Lab 6 — Sensitive files served directly via misconfigured static/URL routing
    path('.env', serve_env_file),
    path('.git/config', serve_git_config),
    path('backup.zip', serve_backup_zip),
]
