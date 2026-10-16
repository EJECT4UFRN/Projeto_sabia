from rest_framework.permissions import BasePermission


class EhProfessor(BasePermission):
    """Libera só para professores logados (o painel administrativo)."""

    message = "Esta área é exclusiva para professores."

    def has_permission(self, request, view):
        usuario = request.user
        return bool(usuario and usuario.is_authenticated and usuario.eh_professor)
