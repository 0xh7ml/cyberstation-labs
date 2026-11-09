from django.contrib.auth.models import AbstractUser
from django.db import models


class BankUser(AbstractUser):
    ROLE_CHOICES = [
        ('customer', 'Customer'),
        ('admin', 'Admin'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='customer')
    phone = models.CharField(max_length=20, blank=True)

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'

    def __str__(self):
        return f'{self.username} ({self.role})'


class BankAccount(models.Model):
    ACCOUNT_TYPE_CHOICES = [
        ('checking', 'Checking'),
        ('savings', 'Savings'),
    ]
    user = models.ForeignKey(BankUser, on_delete=models.CASCADE, related_name='accounts')
    account_number = models.CharField(max_length=20, unique=True)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES, default='checking')

    def __str__(self):
        return f'{self.account_number} ({self.user.username})'
