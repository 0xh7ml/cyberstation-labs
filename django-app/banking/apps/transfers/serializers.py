from rest_framework import serializers
from .models import Transfer


class TransferSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transfer
        fields = ['id', 'from_account', 'to_account', 'amount', 'note', 'timestamp', 'status']
