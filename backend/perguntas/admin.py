from django.contrib import admin

from .models import Categoria, Pergunta


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ("nome", "dono")
    list_filter = ("dono",)
    search_fields = ("nome",)


@admin.register(Pergunta)
class PerguntaAdmin(admin.ModelAdmin):
    list_display = ("texto", "categoria", "dificuldade", "ativa", "dono", "atualizada_em")
    list_filter = ("ativa", "dificuldade", "dono")
    search_fields = ("texto",)
