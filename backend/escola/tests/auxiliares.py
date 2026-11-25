from escola.models import Disciplina


def disciplina(dono, nome="Ciências"):
    """Disciplina do professor com esse nome (cria se ainda não existir)."""
    nome = " ".join(nome.split())
    return Disciplina.objects.get_or_create(dono=dono, chave=nome.casefold(), defaults={"nome": nome})[0]
