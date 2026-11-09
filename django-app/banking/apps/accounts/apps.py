from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = 'banking.apps.accounts'
    label = 'accounts'
    verbose_name = 'Accounts'
    default_auto_field = 'django.db.models.BigAutoField'
