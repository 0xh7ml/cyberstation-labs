from decimal import Decimal

from rest_framework.response import Response
from rest_framework.views import APIView

from banking.apps.accounts.models import BankAccount
from .models import Transfer
from .serializers import TransferSerializer


class TransferView(APIView):
    """
    POST /api/transfers/

    A06 Lab 14 — Negative transfer amount:
    The view validates that the sender has sufficient balance when the amount
    is positive, but it does NOT check that amount > 0.  Submitting a negative
    amount (e.g. {"amount": -500}) passes the balance check and reverses the
    money flow — the "sender" actually receives money from the "recipient".

    No authentication is required (intentional for lab simplicity).
    """

    def post(self, request):
        from_account_id = request.data.get('from_account_id')
        to_account_id = request.data.get('to_account_id')
        amount = request.data.get('amount')

        if not all([from_account_id, to_account_id, amount is not None]):
            return Response({'error': 'from_account_id, to_account_id, and amount are required'}, status=400)

        try:
            amount = Decimal(str(amount))
        except Exception:
            return Response({'error': 'Invalid amount'}, status=400)

        try:
            from_account = BankAccount.objects.get(id=from_account_id)
        except BankAccount.DoesNotExist:
            return Response({'error': 'Source account not found'}, status=404)

        try:
            to_account = BankAccount.objects.get(id=to_account_id)
        except BankAccount.DoesNotExist:
            return Response({'error': 'Destination account not found'}, status=404)

        # A06 Lab 14 — Vulnerable: only checks balance for positive amounts.
        # A negative amount passes this check and reverses the money flow.
        if amount > 0 and from_account.balance < amount:
            return Response({'error': 'Insufficient balance'}, status=400)

        # Execute transfer — amount can be negative here, reversing the direction
        from_account.balance -= amount
        to_account.balance += amount
        from_account.save()
        to_account.save()

        transfer = Transfer.objects.create(
            from_account=from_account,
            to_account=to_account,
            amount=amount,
            note=request.data.get('note', ''),
            status='completed',
        )

        serializer = TransferSerializer(transfer)
        return Response(serializer.data, status=201)


class TransferListView(APIView):
    """
    GET /api/transfers/

    Returns all transfers with no ownership check — any caller can see
    every transfer in the system (Broken Object Level Authorization).
    """

    def get(self, request):
        transfers = Transfer.objects.all().order_by('-timestamp')
        serializer = TransferSerializer(transfers, many=True)
        return Response(serializer.data)
