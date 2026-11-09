import base64
import json

from django.contrib.auth import authenticate
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BankUser
from .serializers import BankUserSerializer


# ---------------------------------------------------------------------------
# Minimal JWT helpers — intentionally weak (no signature verification)
# ---------------------------------------------------------------------------

def _b64_encode(data: dict) -> str:
    raw = json.dumps(data, separators=(',', ':')).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()


def _b64_decode(segment: str) -> dict:
    padding = 4 - len(segment) % 4
    if padding != 4:
        segment += '=' * padding
    return json.loads(base64.urlsafe_b64decode(segment))


def generate_token(user: BankUser) -> str:
    """
    Generate a JWT-shaped token with a fixed, unhashed signature.
    Intentionally insecure — the signature is never verified.
    """
    header = _b64_encode({'alg': 'HS256', 'typ': 'JWT'})
    payload = _b64_encode({
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
    })
    # Fixed "signature" — not a real HMAC
    signature = base64.urlsafe_b64encode(b'training-secret').rstrip(b'=').decode()
    return f'{header}.{payload}.{signature}'


def decode_token(token: str):
    """
    Decode a JWT payload without verifying the signature.
    Intentionally vulnerable — any modified token is accepted.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        return _b64_decode(parts[1])
    except Exception:
        return None


def get_user_from_request(request):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header[7:]
    data = decode_token(token)
    if not data:
        return None
    try:
        return BankUser.objects.get(id=data['user_id'])
    except BankUser.DoesNotExist:
        return None


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

class LoginView(APIView):
    """
    POST /api/accounts/login/

    A06 Lab 16 — User enumeration: distinct error messages reveal whether the
    username exists in the system. No rate limiting.
    """

    def post(self, request):
        username = request.data.get('username', '')
        password = request.data.get('password', '')

        # A06 Lab 16 — Enumeration: "User not found" vs "Incorrect password"
        try:
            user = BankUser.objects.get(username=username)
        except BankUser.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        if not user.check_password(password):
            return Response({'error': 'Incorrect password'}, status=401)

        token = generate_token(user)
        return Response({
            'token': token,
            'user': BankUserSerializer(user).data,
        })


class ProfileView(APIView):
    """
    GET/PATCH /api/accounts/profile/

    A06 Lab 15 — Mass assignment: PATCH accepts the 'role' field without
    restriction, allowing any authenticated user to escalate to admin.
    Token signature is never verified.
    """

    def get(self, request):
        user = get_user_from_request(request)
        if not user:
            return Response({'error': 'Unauthorized'}, status=401)
        serializer = BankUserSerializer(user)
        return Response(serializer.data)

    def patch(self, request):
        user = get_user_from_request(request)
        if not user:
            return Response({'error': 'Unauthorized'}, status=401)

        # A06 Lab 15 — Mass assignment: all request fields (including 'role')
        # are passed directly to the serializer with no field filtering.
        serializer = BankUserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class DebugView(APIView):
    """
    GET /api/accounts/debug/

    A02 Lab 4 — Intentional unhandled exception triggers Django debug page,
    exposing settings, local variables, installed packages, and stack trace.
    """

    def get(self, request):
        raise ValueError('intentional debug trigger')


@method_decorator(csrf_exempt, name='dispatch')
class EnvFileView(View):
    """
    GET /.env  (also reachable via /api/accounts/env/)

    A02 Lab 6 — .env file readable via the application because static files
    are misconfigured to serve from /app/static/ where .env lives.
    """

    def get(self, request):
        env_path = '/app/static/.env'
        try:
            with open(env_path, 'r') as f:
                content = f.read()
            return HttpResponse(content, content_type='text/plain')
        except FileNotFoundError:
            return HttpResponse('Not found', status=404)
