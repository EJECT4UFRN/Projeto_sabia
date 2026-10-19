# Sabiá

Plataforma de quiz ao vivo para escolas, desenvolvida pela EJECT para o Projeto Sinergy.
O professor cria perguntas e quizzes, abre uma sala com PIN e projeta as perguntas; os
estudantes entram pelo PIN (com conta ou como convidado) e respondem pelo celular.

- **Backend:** Django 5.1 + Django REST Framework, JWT (simplejwt), Channels + Redis para o tempo real
- **Frontend:** React 19 + Vite, React Router, CSS Modules
- **Banco:** PostgreSQL

Mockup de referência: Figma "Sabiá - Projeto Sinergy - EJECT".

## Equipe

| Papel | Nome |
|---|---|
| Scrum Master e PO | Carlos Gabriel |
| Desenvolvedor fullstack | Ryan Guilherme |
| UX/UI | Állex Thierry |

## Progresso

Cada etapa tem um peso no frontend e no backend, pelo esforço estimado. A etapa só conta
quando está pronta, com testes e comparação com o mockup. O total é a média do front e do back.

| Etapa | Peso front | Peso back | Situação |
|---|---:|---:|---|
| 1. Estrutura base e layouts | 8% | 8% | ✅ Concluída |
| 2. Autenticação (entrar, criar conta, recuperar senha) | 12% | 12% | ✅ Concluída |
| 3. Banco de perguntas | 12% | 10% | ✅ Concluída |
| 4. Quizzes (Meus jogos, editor, nova pergunta) | 13% | 11% | ✅ Concluída |
| 5. Partida ao vivo (sala com PIN, perguntas, ranking) | 25% | 30% | ✅ Concluída (aguardando aprovação) |
| 6. Histórico e perfil | 12% | 10% | ⏳ A fazer |
| 7. Materiais e disciplinas | 8% | 9% | ⏳ A fazer |
| 8. Dashboard do professor | 10% | 10% | ⏳ A fazer |

| Parte | Concluído | Falta |
|---|---:|---:|
| **Frontend** | **70%** | 30% |
| **Backend** | **71%** | 29% |
| **Total do projeto** | **71%** | 29% |

## Rodando com Docker

```bash
cp .env.exemplo .env
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000/api/ (verificação: `/api/saude/`)
- Admin do Django: http://localhost:8000/admin/

Contas de professor são criadas pelo próprio site em `/professor/criar-conta` (link
"Administrador? Painel administrativo →" na tela de criar conta).

### E-mail (recuperação de senha)

Sem configuração, os e-mails de "Esqueci minha senha" são impressos no terminal do backend
(`docker compose logs backend`), com o link pronto para abrir. Para enviar de verdade,
preencha as variáveis `EMAIL_*` no `.env` (veja `.env.exemplo`).

## Rodando os testes

```bash
# backend (fora do Docker usa SQLite e camada de canais em memória)
cd backend && pip install -r requirements.txt && pytest && ruff check .

# frontend
cd frontend && npm install && npm test && npm run lint && npm run build
```

## Regras de negócio confirmadas

- **Perfis:** estudante e professor. O professor é o administrador e só vê os próprios
  quizzes, perguntas e materiais.
- **Pontuação:** estilo Kahoot, até 1000 pontos por acerto proporcional ao tempo de
  resposta; erro vale 0.
- **Entrada pelo PIN:** com conta (a partida vai para o histórico) ou como convidado, só
  com apelido (nada fica salvo).
- **Materiais:** PDF enviado como arquivo; vídeos e artigos como link.
- **Login:** por nome de usuário ou e-mail (sem diferenciar maiúsculas). "Manter minha conta
  conectada" guarda a sessão por até 7 dias; desmarcado, ela some ao fechar o navegador.
- **Cadastro:** nome de usuário único, pode ter espaços ("Ryan Guilherme"); espaços repetidos
  e nas pontas são removidos. E-mail opcional, mas único quando informado.
  Professores têm cadastro próprio.
- **Esqueci minha senha:** link por e-mail, válido por 1 hora e de uso único. Contas sem
  e-mail não conseguem recuperar a senha sozinhas.

- **Banco de perguntas:** cada pergunta tem exatamente 4 alternativas (sem repetir) e uma
  correta; imagem opcional (JPG, PNG, WEBP ou GIF, até 5 MB). Tempo limite (5 a 300 s) e
  pontuação máxima (100 a 2000) são da própria pergunta e valem na partida; os do quiz só
  servem de padrão para perguntas criadas dentro dele. Cada professor só vê as próprias
  perguntas e categorias.
- **Categoria x disciplina:** categoria é o tema da pergunta (ex.: Energia Solar), criada pelo
  professor; disciplina é a matéria do quiz e dos materiais (ex.: Ciências). São listas separadas.
- **Pergunta inativa:** não aparece para ser adicionada a novos quizzes, mas continua nos que
  já a usam. Pergunta que já está em algum quiz pode ser editada, mas não excluída (a API
  responde 409; o campo `em_quizzes` diz em quantos quizzes ela está).
- **Quizzes:** ficam salvos e podem ser jogados quantas vezes o professor quiser, até ele
  excluir. Só quiz **publicado** pode iniciar partida, e para publicar precisa de ao menos
  1 pergunta. A estrela marca favorito e também serve de filtro. Disciplina e turma são texto
  livre (turma opcional); dificuldade aparece no card e filtra a lista. Tempo e pontuação do
  quiz só pré-preenchem perguntas novas. Embaralhar sorteia uma ordem nova a cada partida, a
  mesma para todos.
- **Perguntas do quiz:** "Criar pergunta" dentro do quiz salva também no banco. O lápis numa
  pergunta do quiz cria uma cópia só para aquele quiz (o banco não muda). Duplicar um quiz copia
  as perguntas também. Essas cópias não aparecem no banco e somem quando saem do quiz ou quando
  o quiz é excluído.

- **Partida ao vivo:**
  - O professor abre a sala de um quiz publicado e escolhe o limite de participantes (1 a 500,
    padrão 50). Ele pode ter várias salas abertas ao mesmo tempo; cada uma tem um PIN de 6 números.
  - O estudante entra pelo PIN (digitando ou pelo QR Code), logado ou como convidado, só com um
    apelido. O apelido não pode repetir na mesma sala. Dá para entrar com o jogo já começado, sem
    os pontos das perguntas que já passaram. Quem recarrega a página no mesmo aparelho volta com os
    mesmos pontos.
  - O professor pode tirar participantes da sala. O celular mostra a pergunta e as alternativas
    com texto, cor e símbolo.
  - Vale a primeira resposta. As respostas encerram quando o tempo acaba, quando todos responderam
    ou quando o professor clica em "Encerrar respostas"; avançar é sempre com o professor.
  - Pontuação: acerto vale de 100% (resposta na hora) a 50% (no último segundo) da pontuação da
    pergunta, mais +100 por acerto seguido a partir do 2º (máximo +500 por pergunta). Erro ou falta
    de resposta vale 0 e zera a sequência.
  - Ranking parcial com os 5 primeiros no telão; cada estudante vê a própria posição. No fim, pódio
    com os 3 primeiros e o resumo da partida. Sala cancelada antes de começar não conta como
    partida realizada.
  - As perguntas são copiadas para a partida ao abrir a sala (com a ordem sorteada, se o quiz pedir),
    então editar ou excluir o quiz não afeta uma partida em andamento nem o histórico.

## API de autenticação (`/api/auth/`)

| Método | Rota | O que faz |
|---|---|---|
| POST | `cadastro/` | Cria a conta (`perfil`: estudante ou professor) e devolve os tokens |
| POST | `entrar/` | Login por usuário ou e-mail; devolve `access`, `refresh` e `usuario` |
| POST | `renovar/` | Troca o `refresh` por um novo `access` |
| POST | `sair/` | Invalida o `refresh` |
| GET | `eu/` | Dados do usuário logado |
| POST | `esqueci-senha/` | Envia o link de redefinição |
| POST | `redefinir-senha/` | Define a nova senha com `uid` + `token` do link |

## API do banco de perguntas (só professores)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/perguntas/` | Lista paginada (10 por página). Filtros: `busca`, `categoria`, `dificuldade`, `ativa`, `pagina` |
| POST | `/api/perguntas/` | Cria (JSON, ou multipart quando há `imagem`) |
| GET/PATCH/DELETE | `/api/perguntas/<id>/` | Detalhe, edição (`remover_imagem=true` apaga a imagem) e exclusão |
| GET/POST | `/api/categorias/` | Categorias do professor / "Nova categoria" |

## API dos quizzes (só professores)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/quizzes/` | Lista paginada (6 por página). Filtros: `busca`, `disciplina`, `status`, `dificuldade`, `favorito=true`, `pagina` |
| POST | `/api/quizzes/` | Cria; `perguntas_ids` define as perguntas e a ordem |
| GET/PATCH/DELETE | `/api/quizzes/<id>/` | Detalhe (com `perguntas` completas e `pode_iniciar`), edição e exclusão |
| GET | `/api/quizzes/disciplinas/` | Disciplinas já usadas (para o filtro) |
| POST | `/api/quizzes/<id>/duplicar/` | Cópia em rascunho, com cópias das perguntas |
| PATCH | `/api/quizzes/<id>/perguntas/<pergunta_id>/` | Lápis: edita a pergunta só neste quiz |

## Partida ao vivo

| Método | Rota | O que faz |
|---|---|---|
| POST | `/api/partidas/` | (professor) Abre a sala: `quiz`, `limite_participantes` |
| GET | `/api/partidas/<id>/` | (professor) PIN e estado da sala |
| POST | `/api/partidas/entrar/` | (qualquer um) Entra pelo `pin` com um `apelido`; devolve a `chave` |
| WS | `/ws/partidas/<pin>/?token=<access>` | Telão do professor |
| WS | `/ws/partidas/<pin>/?chave=<chave>` | Celular do estudante |

Pelo WebSocket o servidor manda `{"tipo": "estado", ...}` a cada mudança (cada tela recebe só o
que lhe cabe). O telão envia `{"acao": "iniciar" | "encerrar_respostas" | "mostrar_ranking" |
"proxima" | "encerrar_partida" | "remover"}`; o estudante envia `{"acao": "responder", "letra": "A"}`
ou `{"acao": "sair"}`.

## Estrutura

```
backend/    Django (config/ = projeto, um app por domínio)
frontend/   React (src/componentes, src/paginas, src/estilos/tokens.css)
docker-compose.yml
```

## Pendências conhecidas

- A fonte **PP Telegraf** do mockup é comercial e não está no Google Fonts; o projeto cai
  para Outfit até a licença ser adicionada em `frontend/src/estilos/tokens.css`.
