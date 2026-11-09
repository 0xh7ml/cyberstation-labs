from django.db import models
from django.utils import timezone

from banking.apps.accounts.models import BankAccount


class Transfer(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    from_account = models.ForeignKey(
        BankAccount,
        on_delete=models.CASCADE,
        related_name='outgoing_transfers',
    )
    to_account = models.ForeignKey(
        BankAccount,
        on_delete=models.CASCADE,
        related_name='incoming_transfers',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.TextField(blank=True)
    timestamp = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')

    def __str__(self):
        return f'Transfer {self.id}: {self.from_account} -> {self.to_account} ({self.amount})'
