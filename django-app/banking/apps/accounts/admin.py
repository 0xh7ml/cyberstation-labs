from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import BankUser, BankAccount


# A02 Lab 5 — admin panel enabled, BankUser and BankAccount registered
@admin.register(BankUser)
class BankUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'phone', 'is_staff', 'is_superuser')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active')
    fieldsets = UserAdmin.fieldsets + (
        ('Banking', {'fields': ('role', 'phone')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Banking', {'fields': ('role', 'phone')}),
    )
    search_fields = ('username', 'email', 'phone')


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ('account_number', 'user', 'account_type', 'balance')
    list_filter = ('account_type',)
    search_fields = ('account_number', 'user__username')
    raw_id_fields = ('user',)
