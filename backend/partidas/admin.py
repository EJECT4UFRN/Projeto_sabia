from django.contrib import admin

from .models import Participante, Partida


class ParticipanteInline(admin.TabularInline):
    model = Participante
    extra = 0
    fields = ("apelido", "usuario", "pontos", "acertos", "removido")
    readonly_fields = fields


@admin.register(Partida)
class PartidaAdmin(admin.ModelAdmin):
    list_display = ("titulo", "pin", "estado", "professor", "criada_em")
    list_filter = ("estado",)
    search_fields = ("titulo", "pin")
    inlines = [ParticipanteInline]
