from django.urls import path
from .views import LoginView, ProfileView, DebugView, EnvFileView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('debug/', DebugView.as_view(), name='debug'),
    path('env/', EnvFileView.as_view(), name='env-file'),
]
