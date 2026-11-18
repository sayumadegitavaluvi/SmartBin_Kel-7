from .all_latest_views import latest_all_bins
from django.urls import path
from .bin_views import list_bins, bin_detail
from .location_views import list_locations, location_detail
from .views import health_check, latest_bin_monitoring, receive_monitoring

from .clustering_views import clustering_predict

from .clustering_history_views import clustering_from_history

from .history_views import bin_history

from .clustering_readiness_views import clustering_readiness

from .clustering_live_status_views import clustering_history_status

from .clustering_overview_views import clustering_overview

from .auth_views import auth_me
from .clustering_public_views import clustering_public_overview

urlpatterns = [
    path("auth/me/", auth_me, name="auth-me"),
    path("clustering/public-overview/", clustering_public_overview, name="clustering-public-overview"),
    path("clustering/overview/", clustering_overview, name="clustering-overview"),
    path("clustering/history-status/<str:bin_identifier>/", clustering_history_status, name="clustering-history-status"),
    path("clustering/readiness/", clustering_readiness, name="clustering-readiness"),
    path("clustering/from-history/", clustering_from_history, name="clustering-from-history"),
    path("clustering/predict/", clustering_predict, name="clustering-predict"),
    path("bins/", list_bins, name="bin-list"),
    path("bins/latest/", latest_all_bins, name="latest-all-bins"),
    path("bins/<str:bin_identifier>/history/", bin_history, name="bin-history"),
    path("bins/<str:bin_identifier>/", bin_detail, name="bin-detail"),
    path("locations/", list_locations, name="location-list"),
    path("locations/<int:id_lokasi>/", location_detail, name="location-detail"),
    path("monitoring/", receive_monitoring, name="receive-monitoring"),
    path("bins/<str:bin_identifier>/latest/", latest_bin_monitoring, name="latest-bin-monitoring"),
    path('health/', health_check, name='health-check'),
]
