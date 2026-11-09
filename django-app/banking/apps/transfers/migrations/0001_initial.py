import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Transfer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('note', models.TextField(blank=True)),
                ('timestamp', models.DateTimeField(default=django.utils.timezone.now)),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('completed', 'Completed'), ('failed', 'Failed')],
                    default='completed',
                    max_length=20,
                )),
                ('from_account', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='outgoing_transfers',
                    to='accounts.bankaccount',
                )),
                ('to_account', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='incoming_transfers',
                    to='accounts.bankaccount',
                )),
            ],
        ),
    ]
