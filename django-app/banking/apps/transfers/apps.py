from django.apps import AppConfig


class TransfersConfig(AppConfig):
    name = 'banking.apps.transfers'
    label = 'transfers'
    verbose_name = 'Transfers'
    default_auto_field = 'django.db.models.BigAutoField'
