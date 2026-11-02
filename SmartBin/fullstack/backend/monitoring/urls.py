from django.urls import path
from .views import health_check, latest_bin_monitoring, receive_monitoring

urlpatterns = [
    path("monitoring/", receive_monitoring, name="receive-monitoring"),
    path("bins/<str:bin_identifier>/latest/", latest_bin_monitoring, name="latest-bin-monitoring"),
    path('health/', health_check, name='health-check'),
]
