"""
seed_data management command

Populates the database with training data for SecureBank Labs:
  - Superuser admin/admin          (A02 Lab 5)
  - Customer alice/password123     with account ACC-1001, balance 4200
  - Customer bob/qwerty            with account ACC-1002, balance 12800
  - 3 sample transfers
  - /app/static/.env               copied from banking/static/ (A02 Lab 6)
  - /app/static/backup.zip         containing a copy of django.db (A02 Lab 6)
"""
import os
import shutil
import zipfile

from django.core.management.base import BaseCommand

from banking.apps.accounts.models import BankAccount, BankUser
from banking.apps.transfers.models import Transfer


class Command(BaseCommand):
    help = 'Seed the database with training data for SecureBank Labs'

    def handle(self, *args, **options):
        self._setup_static_dir()
        self._create_users()
        self._create_transfers()
        self._create_backup_zip()
        self.stdout.write(self.style.SUCCESS('Seed data loaded successfully.'))

    # ------------------------------------------------------------------
    # Static directory setup — A02 Lab 6
    # Copies sensitive files from banking/static/ into /app/static/ so
    # that the misconfigured STATICFILES_DIRS = ['/app/static'] exposes them.
    # ------------------------------------------------------------------

    def _setup_static_dir(self):
        static_dir = '/app/static'
        os.makedirs(static_dir, exist_ok=True)

        # Source files shipped inside the Django project (copied to /app/ by COPY . .)
        source_static = '/app/banking/static'

        for filename in ['.env', 'backup_note.txt']:
            src = os.path.join(source_static, filename)
            dst = os.path.join(static_dir, filename)
            if os.path.exists(src) and not os.path.exists(dst):
                shutil.copy2(src, dst)
                self.stdout.write(f'  Staged {filename} -> {static_dir}/')

    # ------------------------------------------------------------------
    # Users & accounts
    # ------------------------------------------------------------------

    def _create_users(self):
        # A02 Lab 5 — superuser with trivial credentials accessible via /admin/
        if not BankUser.objects.filter(username='admin').exists():
            admin = BankUser.objects.create_superuser(
                username='admin',
                password='admin',
                email='admin@securebank.lab',
                role='admin',
            )
            self.stdout.write(f'  Created superuser: {admin.username}')
        else:
            admin = BankUser.objects.get(username='admin')
            self.stdout.write(f'  Superuser already exists: {admin.username}')

        # Customer alice
        alice, alice_created = BankUser.objects.get_or_create(
            username='alice',
            defaults={
                'email': 'alice@securebank.lab',
                'role': 'customer',
                'phone': '555-0101',
            },
        )
        if alice_created:
            alice.set_password('password123')
            alice.save()
            self.stdout.write(f'  Created customer: {alice.username}')

        alice_account, _ = BankAccount.objects.get_or_create(
            account_number='ACC-1001',
            defaults={
                'user': alice,
                'balance': 4200.00,
                'account_type': 'checking',
            },
        )

        # Customer bob
        bob, bob_created = BankUser.objects.get_or_create(
            username='bob',
            defaults={
                'email': 'bob@securebank.lab',
                'role': 'customer',
                'phone': '555-0102',
            },
        )
        if bob_created:
            bob.set_password('qwerty')
            bob.save()
            self.stdout.write(f'  Created customer: {bob.username}')

        bob_account, _ = BankAccount.objects.get_or_create(
            account_number='ACC-1002',
            defaults={
                'user': bob,
                'balance': 12800.00,
                'account_type': 'savings',
            },
        )

        self._alice_account = alice_account
        self._bob_account = bob_account

    # ------------------------------------------------------------------
    # Transfers
    # ------------------------------------------------------------------

    def _create_transfers(self):
        if Transfer.objects.exists():
            self.stdout.write('  Transfers already seeded, skipping.')
            return

        alice_account = self._alice_account
        bob_account = self._bob_account

        transfers = [
            Transfer(
                from_account=alice_account,
                to_account=bob_account,
                amount=250.00,
                note='Rent share',
                status='completed',
            ),
            Transfer(
                from_account=bob_account,
                to_account=alice_account,
                amount=75.50,
                note='Dinner split',
                status='completed',
            ),
            Transfer(
                from_account=alice_account,
                to_account=bob_account,
                amount=1000.00,
                note='Loan repayment',
                status='completed',
            ),
        ]
        Transfer.objects.bulk_create(transfers)
        self.stdout.write(f'  Created {len(transfers)} sample transfers.')

    # ------------------------------------------------------------------
    # Backup zip — A02 Lab 6
    # ------------------------------------------------------------------

    def _create_backup_zip(self):
        static_dir = '/app/static'
        db_path = '/app/data/django.db'
        zip_path = os.path.join(static_dir, 'backup.zip')

        os.makedirs(static_dir, exist_ok=True)

        if not os.path.exists(db_path):
            self.stdout.write(self.style.WARNING(
                f'  Database file not found at {db_path}; backup.zip not created.'
            ))
            return

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.write(db_path, 'django.db')

        self.stdout.write(
            self.style.SUCCESS(f'  Created backup.zip at {zip_path} (A02 Lab 6 target).')
        )
