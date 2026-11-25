from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ("username", "email", "perfil", "is_active", "date_joined")
    list_filter = ("perfil", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        ("Sabiá", {"fields": ("perfil", "nome_exibicao", "cor_avatar", "sobre_mim")}),
    )
