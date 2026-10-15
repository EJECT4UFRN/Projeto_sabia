import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def limpar_limite_de_tentativas():
    """O limite de tentativas usa o cache; zera entre os testes para um não afetar o outro."""
    cache.clear()
    yield
    cache.clear()
