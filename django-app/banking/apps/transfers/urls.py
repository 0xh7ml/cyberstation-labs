from django.urls import path
from .views import TransferView, TransferListView

urlpatterns = [
    path('', TransferListView.as_view(), name='transfer-list'),
    path('create/', TransferView.as_view(), name='transfer-create'),
]
