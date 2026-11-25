from django.contrib import admin

from .models import Material


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ("titulo", "tipo", "disciplina", "status", "publico", "dono", "criado_em")
    list_filter = ("tipo", "status", "publico")
    search_fields = ("titulo", "descricao")
    filter_horizontal = ("turmas",)
