from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("cadastro/", views.CadastroView.as_view(), name="cadastro"),
    path("entrar/", views.EntrarView.as_view(), name="entrar"),
    path("renovar/", TokenRefreshView.as_view(), name="renovar-token"),
    path("sair/", views.SairView.as_view(), name="sair"),
    path("eu/", views.EuView.as_view(), name="eu"),
    path("alterar-senha/", views.AlterarSenhaView.as_view(), name="alterar-senha"),
    path("esqueci-senha/", views.EsqueciSenhaView.as_view(), name="esqueci-senha"),
    path("redefinir-senha/", views.RedefinirSenhaView.as_view(), name="redefinir-senha"),
]
