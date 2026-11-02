from django.http import JsonResponse
from django.contrib import admin
from django.urls import path, include

def api_home(request):
    return JsonResponse({
        "service": "SmartBin Backend API",
        "status": "running",
        "framework": "Django REST Framework",
        "endpoints": {
            "health": "/api/health/"
        }
    })


urlpatterns = [
    path('', api_home, name='api-home'),
    path('admin/', admin.site.urls),
    path('api/', include('monitoring.urls')),
]
