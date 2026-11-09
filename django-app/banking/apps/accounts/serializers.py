from rest_framework import serializers
from .models import BankUser, BankAccount


class BankUserSerializer(serializers.ModelSerializer):
    # A06 Lab 15 — 'role' is writable; no restriction prevents a customer
    # from sending {"role": "admin"} in a PATCH request (mass assignment)
    class Meta:
        model = BankUser
        fields = ['id', 'username', 'email', 'role', 'phone', 'first_name', 'last_name']
        # role is intentionally NOT in read_only_fields


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ['id', 'account_number', 'balance', 'account_type', 'user']
