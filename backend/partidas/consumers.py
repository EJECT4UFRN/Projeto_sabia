import asyncio
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from . import jogo
from .models import Participante, Partida

# Códigos de fechamento enviados ao navegador.
NAO_AUTORIZADO, NAO_ENCONTRADA, REMOVIDO = 4401, 4404, 4403

ACOES_PROFESSOR = {
    "iniciar",
    "encerrar_respostas",
    "mostrar_ranking",
    "proxima",
    "encerrar_partida",
    "remover",
}


@database_sync_to_async
def _identificar(pin, consulta):
    """Devolve ("professor", partida) ou ("participante", participante), ou None."""
    token = consulta.get("token", [None])[0]
    chave = consulta.get("chave", [None])[0]
    if token:
        try:
            usuario_id = AccessToken(token)["user_id"]
        except (TokenError, KeyError):
            return None
        usuario = get_user_model().objects.filter(pk=usuario_id, perfil="professor").first()
        if usuario is None:
            return None
        partida = Partida.objects.filter(pin=pin, professor=usuario).order_by("-criada_em").first()
        return ("professor", partida) if partida else None
    if chave:
        try:
            participante = Participante.objects.select_related("partida").get(chave=chave, partida__pin=pin)
        except (Participante.DoesNotExist, ValueError):
            return None
        if participante.removido:
            return None
        return ("participante", participante)
    return None


class PartidaConsumer(AsyncJsonWebsocketConsumer):
    """Uma conexão por tela: o telão do professor ou o celular de um estudante.

    Toda mudança de estado é avisada ao grupo da partida; cada conexão então monta e envia
    o próprio retrato (o professor vê tudo; o estudante só o que lhe cabe).
    """

    papel = None
    partida_id = None
    participante = None
    cronometro = None

    async def connect(self):
        pin = self.scope["url_route"]["kwargs"]["pin"]
        consulta = parse_qs(self.scope.get("query_string", b"").decode())
        identificado = await _identificar(pin, consulta)
        await self.accept()
        if identificado is None:
            await self.send_json({"tipo": "erro", "mensagem": "Não foi possível entrar nesta partida."})
            await self.close(code=NAO_ENCONTRADA)
            return
        self.papel, objeto = identificado
        if self.papel == "professor":
            self.partida_id = objeto.id
        else:
            self.participante = objeto
            self.partida_id = objeto.partida_id
        self.grupo = f"partida_{self.partida_id}"
        await self.channel_layer.group_add(self.grupo, self.channel_name)
        if self.papel == "participante":
            await self._avisar_grupo()  # o telão atualiza a lista de quem está na sala
        else:
            await self._enviar_estado()
            await self._agendar_fim_da_pergunta()

    async def disconnect(self, code):
        if self.cronometro:
            self.cronometro.cancel()
        if self.partida_id:
            await self.channel_layer.group_discard(self.grupo, self.channel_name)

    async def receive_json(self, conteudo, **kwargs):
        acao = conteudo.get("acao")
        try:
            if self.papel == "professor" and acao in ACOES_PROFESSOR:
                await self._acao_professor(acao, conteudo)
            elif self.papel == "participante" and acao == "responder":
                todos = await database_sync_to_async(jogo.responder)(self.participante, conteudo.get("letra"))
                if todos:
                    await database_sync_to_async(jogo.encerrar_respostas)(await self._partida())
                await self._avisar_grupo()
            elif self.papel == "participante" and acao == "sair":
                await database_sync_to_async(jogo.sair)(self.participante)
                await self._avisar_grupo()
            else:
                await self.send_json({"tipo": "erro", "mensagem": "Ação não permitida."})
        except jogo.ErroJogo as erro:
            await self.send_json({"tipo": "erro", "mensagem": erro.mensagem})

    async def _acao_professor(self, acao, conteudo):
        partida = await self._partida()
        executar = database_sync_to_async
        if acao == "iniciar":
            await executar(jogo.iniciar)(partida)
        elif acao == "encerrar_respostas":
            # "numero" (opcional) é a pergunta que o telão quer encerrar, para não fechar a seguinte.
            numero = conteudo.get("numero")
            await executar(jogo.encerrar_respostas)(partida, numero - 1 if isinstance(numero, int) else None)
        elif acao == "mostrar_ranking":
            await executar(jogo.mostrar_ranking)(partida)
        elif acao == "proxima":
            await executar(jogo.proxima)(partida)
        elif acao == "encerrar_partida":
            await executar(jogo.finalizar)(partida)
        elif acao == "remover":
            await executar(jogo.remover)(partida, conteudo.get("participante"))
        await self._avisar_grupo()
        await self._agendar_fim_da_pergunta()

    async def _agendar_fim_da_pergunta(self):
        """No telão: quando o tempo da pergunta acabar, encerra as respostas sozinho."""
        if self.cronometro:
            self.cronometro.cancel()
            self.cronometro = None
        partida = await self._partida()
        if partida.estado != Partida.Estado.PERGUNTA:
            return
        espera = max((partida.prazo - timezone.now()).total_seconds(), 0) + 0.3
        self.cronometro = asyncio.ensure_future(self._encerrar_depois(espera, partida.indice))

    async def _encerrar_depois(self, espera, indice):
        await asyncio.sleep(espera)
        if await database_sync_to_async(jogo.encerrar_respostas)(await self._partida(), indice):
            await self._avisar_grupo()

    @database_sync_to_async
    def _partida(self):
        return Partida.objects.get(pk=self.partida_id)

    async def _avisar_grupo(self):
        await self.channel_layer.group_send(self.grupo, {"type": "partida.atualizar"})

    async def partida_atualizar(self, evento):
        await self._enviar_estado()

    async def _enviar_estado(self):
        if self.papel == "professor":
            dados = await database_sync_to_async(jogo.estado_professor)(await self._partida())
        else:
            dados = await database_sync_to_async(jogo.estado_participante)(self.participante)
        await self.send_json(dados)
        if dados["tipo"] == "removido":
            await self.close(code=REMOVIDO)
