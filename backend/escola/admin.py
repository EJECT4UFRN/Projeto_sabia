from django.contrib import admin

from .models import Disciplina, Turma


@admin.register(Disciplina)
class DisciplinaAdmin(admin.ModelAdmin):
    list_display = ("nome", "dono", "criada_em")
    search_fields = ("nome",)


@admin.register(Turma)
class TurmaAdmin(admin.ModelAdmin):
    list_display = ("nome", "codigo", "dono", "criada_em")
    search_fields = ("nome", "codigo")
    filter_horizontal = ("alunos",)
