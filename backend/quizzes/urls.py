from rest_framework.routers import DefaultRouter

from .views import QuizViewSet

roteador = DefaultRouter()
roteador.register("quizzes", QuizViewSet, basename="quiz")

urlpatterns = roteador.urls
