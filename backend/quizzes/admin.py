from django.contrib import admin

from .models import Quiz, QuizPergunta


class QuizPerguntaInline(admin.TabularInline):
    model = QuizPergunta
    extra = 0
    raw_id_fields = ("pergunta",)


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ("titulo", "disciplina", "status", "favorito", "dono", "atualizado_em")
    list_filter = ("status", "dificuldade", "dono")
    search_fields = ("titulo", "disciplina")
    inlines = [QuizPerguntaInline]
