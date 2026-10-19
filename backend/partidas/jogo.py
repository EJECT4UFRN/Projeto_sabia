"""Regras da partida ao vivo, sem nada de WebSocket: o consumer só chama estas funções.

Regras confirmadas:
- convidado entra só com apelido; o apelido não pode repetir na mesma sala;
- dá para entrar com o jogo já começado, sem os pontos das perguntas que já passaram;
- o professor pode tirar participantes da sala; quem volta no mesmo aparelho mantém os pontos;
- vale a primeira resposta; as respostas encerram quando o tempo acaba, quando todos
  responderam ou quando o professor encerra; avançar é sempre com o professor;
- acerto vale de 50% (no último segundo) a 100% (na hora) da pontuação da pergunta, mais
  +100 por acerto seguido a partir do 2º (máximo +500); erro ou sem resposta vale 0 e zera
  a sequência;
- cada professor pode ter várias salas abertas; o limite de participantes é escolhido ao abrir.
"""

import random
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import Participante, Partida, Resposta

LETRAS = ("A", "B", "C", "D")
BONUS_POR_ACERTO_SEGUIDO, BONUS_MAXIMO = 100, 500
TOLERANCIA_RESPOSTA = timedelta(seconds=1)  # atraso de rede aceito depois do prazo
TAMANHO_RANKING = 5


class ErroJogo(Exception):
    def __init__(self, mensagem, campo=None):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.campo = campo


def _url_imagem(pergunta, request=None):
    if not pergunta.imagem:
        return None
    return request.build_absolute_uri(pergunta.imagem.url) if request else pergunta.imagem.url


def _gerar_pin():
    ocupados = set(Partida.objects.filter(estado__in=Partida.ATIVAS).values_list("pin", flat=True))
    while True:
        pin = f"{random.randint(0, 999_999):06d}"
        if pin not in ocupados:
            return pin


@transaction.atomic
def abrir_sala(quiz, limite, request=None):
    itens = list(quiz.itens.select_related("pergunta"))
    if quiz.embaralhar_perguntas:
        random.shuffle(itens)
    perguntas = []
    for item in itens:
        p = item.pergunta
        ordem = list(LETRAS)
        if quiz.embaralhar_respostas:
            random.shuffle(ordem)
        perguntas.append(
            {
                "id": p.id,
                "texto": p.texto,
                "imagem": _url_imagem(p, request),
                "alternativas": p.alternativas,
                "correta": p.resposta_correta,
                "ordem": ordem,
                "tempo": p.tempo_limite,
                "pontuacao": p.pontuacao_maxima,
            }
        )
    return Partida.objects.create(
        professor=quiz.dono,
        quiz=quiz,
        titulo=quiz.titulo,
        disciplina=quiz.disciplina,
        pin=_gerar_pin(),
        limite_participantes=limite,
        perguntas=perguntas,
    )


def buscar_partida_ativa(pin):
    return Partida.objects.filter(pin=pin, estado__in=Partida.ATIVAS).order_by("-criada_em").first()


def _ativos(partida):
    return partida.participantes.filter(removido=False)


def entrar(pin, apelido, usuario=None):
    apelido = " ".join((apelido or "").split())
    if not apelido:
        raise ErroJogo("Escolha um apelido para entrar.", "apelido")
    if len(apelido) > 30:
        raise ErroJogo("O apelido pode ter até 30 caracteres.", "apelido")
    pin = "".join(ch for ch in str(pin or "") if ch.isdigit())
    if len(pin) != 6:
        raise ErroJogo("Digite os 6 números do PIN.", "pin")
    partida = buscar_partida_ativa(pin)
    if partida is None:
        raise ErroJogo("Não encontramos uma sala aberta com esse PIN.", "pin")

    with transaction.atomic():
        partida = Partida.objects.select_for_update().get(pk=partida.pk)
        if _ativos(partida).count() >= partida.limite_participantes:
            raise ErroJogo("Esta sala está cheia.", "pin")
        if _ativos(partida).filter(apelido__iexact=apelido).exists():
            raise ErroJogo("Esse apelido já está em uso nesta sala. Escolha outro.", "apelido")
        try:
            with transaction.atomic():
                return Participante.objects.create(
                    partida=partida,
                    apelido=apelido,
                    usuario=usuario if getattr(usuario, "is_authenticated", False) else None,
                )
        except IntegrityError as erro:
            raise ErroJogo("Esse apelido já está em uso nesta sala. Escolha outro.", "apelido") from erro


# --- andamento (ações do professor) ---------------------------------------------------------


def ranking(partida):
    return list(_ativos(partida).order_by("-pontos", "entrou_em", "id"))


def _abrir_pergunta(partida, indice, agora=None):
    agora = agora or timezone.now()
    for posicao, participante in enumerate(ranking(partida), 1):
        if participante.posicao_anterior != posicao:
            participante.posicao_anterior = posicao
            participante.save(update_fields=["posicao_anterior"])
    pergunta = partida.perguntas[indice]
    partida.indice = indice
    partida.estado = Partida.Estado.PERGUNTA
    partida.pergunta_iniciada_em = agora
    partida.prazo = agora + timedelta(seconds=pergunta["tempo"])
    partida.save(update_fields=["indice", "estado", "pergunta_iniciada_em", "prazo"])


@transaction.atomic
def iniciar(partida, agora=None):
    partida = Partida.objects.select_for_update().get(pk=partida.pk)
    if partida.estado != Partida.Estado.SALA:
        raise ErroJogo("A partida já começou.")
    if not partida.perguntas:
        raise ErroJogo("Este quiz não tem perguntas.")
    if not _ativos(partida).exists():
        raise ErroJogo("Espere pelo menos um estudante entrar na sala.")
    partida.iniciada_em = agora or timezone.now()
    partida.save(update_fields=["iniciada_em"])
    _abrir_pergunta(partida, 0, agora)
    return partida


@transaction.atomic
def encerrar_respostas(partida, indice=None):
    """Fecha a pergunta atual. `indice` evita fechar a pergunta seguinte por engano
    (ex.: o cronômetro da pergunta anterior chegando atrasado). Devolve True se fechou."""
    partida = Partida.objects.select_for_update().get(pk=partida.pk)
    if partida.estado != Partida.Estado.PERGUNTA or (indice is not None and indice != partida.indice):
        return False
    sem_resposta = _ativos(partida).exclude(respostas__indice=partida.indice)
    sem_resposta.update(sequencia=0)
    partida.estado = Partida.Estado.RESULTADO
    partida.save(update_fields=["estado"])
    return True


def mostrar_ranking(partida):
    if partida.estado != Partida.Estado.RESULTADO:
        raise ErroJogo("O ranking aparece depois de encerrar as respostas.")
    partida.estado = Partida.Estado.RANKING
    partida.save(update_fields=["estado"])


@transaction.atomic
def proxima(partida, agora=None):
    partida = Partida.objects.select_for_update().get(pk=partida.pk)
    if partida.estado not in (Partida.Estado.RESULTADO, Partida.Estado.RANKING):
        raise ErroJogo("Encerre as respostas antes de avançar.")
    if partida.indice + 1 >= len(partida.perguntas):
        return finalizar(partida)
    _abrir_pergunta(partida, partida.indice + 1, agora)
    return partida


def finalizar(partida):
    """Encerra a partida. Sala que nem começou vira "cancelada" (não conta como partida realizada)."""
    if not partida.ativa:
        return partida
    partida.estado = Partida.Estado.CANCELADA if partida.iniciada_em is None else Partida.Estado.ENCERRADA
    partida.encerrada_em = timezone.now()
    partida.save(update_fields=["estado", "encerrada_em"])
    return partida


def remover(partida, participante_id):
    removidos = _ativos(partida).filter(id=participante_id).update(removido=True)
    if not removidos:
        raise ErroJogo("Esse participante não está mais na sala.")


# --- resposta (ação do estudante) ------------------------------------------------------------


def calcular_pontos(pontuacao, tempo_limite_s, tempo_ms, sequencia_anterior):
    """Devolve (pontos, bonus, nova_sequencia) para um acerto."""
    fracao = min(max(tempo_ms / (tempo_limite_s * 1000), 0), 1)
    base = round(pontuacao * (1 - 0.5 * fracao))
    sequencia = sequencia_anterior + 1
    bonus = min(BONUS_POR_ACERTO_SEGUIDO * (sequencia - 1), BONUS_MAXIMO)
    return base, bonus, sequencia


@transaction.atomic
def responder(participante, letra, agora=None):
    """Registra a resposta. Devolve True quando todos os participantes já responderam."""
    agora = agora or timezone.now()
    letra = str(letra or "").upper()
    if letra not in LETRAS:
        raise ErroJogo("Escolha uma das alternativas.")
    participante = Participante.objects.select_for_update().select_related("partida").get(pk=participante.pk)
    partida = participante.partida
    if participante.removido:
        raise ErroJogo("Você não está mais nesta sala.")
    if partida.estado != Partida.Estado.PERGUNTA or agora > partida.prazo + TOLERANCIA_RESPOSTA:
        raise ErroJogo("O tempo para responder acabou.")
    if participante.respostas.filter(indice=partida.indice).exists():
        raise ErroJogo("Você já respondeu esta pergunta.")

    pergunta = partida.pergunta_atual
    tempo_ms = max(int((agora - partida.pergunta_iniciada_em).total_seconds() * 1000), 0)
    correta = letra == pergunta["correta"]
    pontos = bonus = 0
    if correta:
        pontos, bonus, participante.sequencia = calcular_pontos(
            pergunta["pontuacao"], pergunta["tempo"], tempo_ms, participante.sequencia
        )
        participante.acertos += 1
        participante.maior_sequencia = max(participante.maior_sequencia, participante.sequencia)
    else:
        participante.sequencia = 0
    participante.pontos += pontos + bonus
    participante.save(update_fields=["pontos", "acertos", "sequencia", "maior_sequencia"])
    Resposta.objects.create(
        participante=participante,
        indice=partida.indice,
        letra=letra,
        correta=correta,
        tempo_ms=tempo_ms,
        pontos=pontos,
        bonus=bonus,
    )
    respondidos = Resposta.objects.filter(participante__in=_ativos(partida), indice=partida.indice).count()
    return respondidos >= _ativos(partida).count()


def sair(participante):
    Participante.objects.filter(pk=participante.pk).update(removido=True)


# --- o que cada tela recebe ------------------------------------------------------------------


def _ms(data):
    return int(data.timestamp() * 1000) if data else None


def _alternativas(pergunta):
    return [{"letra": letra, "texto": pergunta["alternativas"][letra]} for letra in pergunta["ordem"]]


def _pergunta_publica(partida, com_correta):
    pergunta = partida.pergunta_atual
    if pergunta is None:
        return None
    dados = {
        "numero": partida.indice + 1,
        "texto": pergunta["texto"],
        "imagem": pergunta["imagem"],
        "alternativas": _alternativas(pergunta),
        "tempo": pergunta["tempo"],
        "prazo": _ms(partida.prazo),
    }
    if com_correta:
        dados["correta"] = pergunta["correta"]
    return dados


def _variacao(posicao, anterior):
    if anterior is None or anterior == posicao:
        return 0
    return anterior - posicao  # positivo = subiu


def _linhas_ranking(lista, limite=None):
    linhas = []
    for posicao, p in enumerate(lista, 1):
        if limite and posicao > limite:
            break
        linhas.append(
            {
                "id": p.id,
                "posicao": posicao,
                "apelido": p.apelido,
                "pontos": p.pontos,
                "sequencia": p.sequencia,
                "acertos": p.acertos,
                "variacao": _variacao(posicao, p.posicao_anterior),
            }
        )
    return linhas


def _media_segundos(respostas):
    return round(sum(r.tempo_ms for r in respostas) / len(respostas) / 1000, 1) if respostas else None


def _resultado(partida, ativos):
    pergunta = partida.pergunta_atual
    respostas = list(Resposta.objects.filter(participante__in=ativos, indice=partida.indice))
    total = len(respostas)
    distribuicao = []
    for letra in pergunta["ordem"]:
        quantidade = sum(1 for r in respostas if r.letra == letra)
        distribuicao.append(
            {
                "letra": letra,
                "texto": pergunta["alternativas"][letra],
                "quantidade": quantidade,
                "percentual": round(quantidade * 100 / total) if total else 0,
                "correta": letra == pergunta["correta"],
            }
        )
    acertaram = sum(1 for r in respostas if r.correta)
    tempo_medio = _media_segundos(respostas)
    return {
        "distribuicao": distribuicao,
        "acertaram": acertaram,
        "erraram": len(ativos) - acertaram,
        "tempo_medio": tempo_medio,
    }


def _estatisticas_finais(partida, ativos):
    respostas = list(Resposta.objects.filter(participante__in=ativos))
    total_perguntas = len(partida.perguntas)
    por_pergunta = []
    for indice in range(total_perguntas):
        acertos = sum(1 for r in respostas if r.indice == indice and r.correta)
        por_pergunta.append(round(acertos * 100 / len(ativos)) if ativos else 0)
    possiveis = len(ativos) * total_perguntas
    corretas = sum(1 for r in respostas if r.correta)
    dados = {
        "participantes": len(ativos),
        "media_acertos": round(corretas * 100 / possiveis) if possiveis else 0,
        "tempo_medio": _media_segundos(respostas),
        "mais_dificil": None,
        "maior_acerto": None,
    }
    if por_pergunta and ativos:
        dificil = min(range(total_perguntas), key=lambda i: (por_pergunta[i], i))
        facil = max(range(total_perguntas), key=lambda i: (por_pergunta[i], -i))
        dados["mais_dificil"] = {"numero": dificil + 1, "percentual": por_pergunta[dificil]}
        dados["maior_acerto"] = {"numero": facil + 1, "percentual": por_pergunta[facil]}
    return dados


def _partida_publica(partida, ativos):
    return {
        "id": partida.id,
        "pin": partida.pin,
        "titulo": partida.titulo,
        "disciplina": partida.disciplina,
        "estado": partida.estado,
        "numero": partida.indice + 1,
        "total_perguntas": len(partida.perguntas),
        "participantes": len(ativos),
        "limite": partida.limite_participantes,
        "professor": partida.professor.get_full_name() or partida.professor.username,
        "quiz_id": partida.quiz_id,
    }


def estado_professor(partida):
    partida.refresh_from_db()
    ativos = ranking(partida)
    E = Partida.Estado
    dados = {
        "tipo": "estado",
        "papel": "professor",
        "agora": _ms(timezone.now()),
        "partida": _partida_publica(partida, ativos),
        "participantes": [
            {"id": p.id, "apelido": p.apelido} for p in sorted(ativos, key=lambda p: p.entrou_em)
        ],
    }
    if partida.estado in (E.PERGUNTA, E.RESULTADO, E.RANKING):
        dados["pergunta"] = _pergunta_publica(partida, com_correta=partida.estado != E.PERGUNTA)
        dados["respondidos"] = Resposta.objects.filter(participante__in=ativos, indice=partida.indice).count()
    if partida.estado in (E.RESULTADO, E.RANKING):
        dados["resultado"] = _resultado(partida, ativos)
        dados["ranking"] = _linhas_ranking(ativos, TAMANHO_RANKING)
    if partida.estado == E.ENCERRADA:
        dados["ranking"] = _linhas_ranking(ativos)
        dados["estatisticas"] = _estatisticas_finais(partida, ativos)
    return dados


def estado_participante(participante):
    participante.refresh_from_db()
    partida = participante.partida
    partida.refresh_from_db()
    if participante.removido:
        return {"tipo": "removido"}
    ativos = ranking(partida)
    posicao = next((i for i, p in enumerate(ativos, 1) if p.id == participante.id), None)
    E = Partida.Estado
    dados = {
        "tipo": "estado",
        "papel": "participante",
        "agora": _ms(timezone.now()),
        "partida": _partida_publica(partida, ativos),
        "voce": {
            "id": participante.id,
            "apelido": participante.apelido,
            "pontos": participante.pontos,
            "posicao": posicao,
            "sequencia": participante.sequencia,
            "variacao": _variacao(posicao, participante.posicao_anterior),
        },
    }
    resposta = None
    if partida.estado in (E.PERGUNTA, E.RESULTADO, E.RANKING):
        resposta = participante.respostas.filter(indice=partida.indice).first()
        dados["pergunta"] = _pergunta_publica(partida, com_correta=partida.estado != E.PERGUNTA)
        dados["resposta"] = {"letra": resposta.letra} if resposta else None
    if partida.estado in (E.RESULTADO, E.RANKING):
        pergunta = partida.pergunta_atual
        dados["feedback"] = {
            "respondeu": resposta is not None,
            "correta": bool(resposta and resposta.correta),
            "pontos": resposta.pontos if resposta else 0,
            "bonus": resposta.bonus if resposta else 0,
            "resposta_correta": pergunta["alternativas"][pergunta["correta"]],
        }
        dados["ranking"] = _linhas_ranking(ativos, TAMANHO_RANKING)
    if partida.estado == E.ENCERRADA:
        total = len(partida.perguntas)
        dados["ranking"] = _linhas_ranking(ativos, 3)
        dados["final"] = {
            "posicao": posicao,
            "pontos": participante.pontos,
            "acertos": participante.acertos,
            "erros": total - participante.acertos,
            "percentual": round(participante.acertos * 100 / total) if total else 0,
            "maior_sequencia": participante.maior_sequencia,
            "participantes": len(ativos),
        }
    return dados
