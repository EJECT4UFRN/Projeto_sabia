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
As etapas 9 e 10 entraram depois do plano inicial: os pesos somam 104 no front, então o front é o feito ÷ 104.

| Etapa | Peso front | Peso back | Situação |
|---|---:|---:|---|
| 1. Estrutura base e layouts | 8% | 8% | ✅ Concluída |
| 2. Autenticação (entrar, criar conta, recuperar senha) | 12% | 12% | ✅ Concluída |
| 3. Banco de perguntas | 12% | 10% | ✅ Concluída |
| 4. Quizzes (Meus jogos, editor, nova pergunta) | 13% | 11% | ✅ Concluída |
| 5. Partida ao vivo (sala com PIN, perguntas, ranking) | 25% | 30% | ✅ Concluída |
| 6. Histórico e perfil | 12% | 10% | ✅ Concluída |
| 7. Materiais, disciplinas e turmas | 8% | 9% | ✅ Concluída |
| 8. Dashboard do professor | 10% | 10% | ✅ Concluída |
| 9. Página Como funciona | 2% | 0% | ✅ Concluída |
| 10. Página O projeto (página inicial) | 2% | 0% | ✅ Concluída |

| Parte | Concluído | Falta |
|---|---:|---:|
| **Frontend** | **100%** | 0% |
| **Backend** | **100%** | 0% |
| **Total do projeto** | **100%** | 0% |

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
- **Materiais:** PDF, DOC ou DOCX enviado como arquivo (até 20 MB); vídeos e artigos como link.
- **Página inicial:** `/` abre "O projeto" (a mesma página de `/o-projeto`), com a lâmpada
  animada e até 3 materiais em destaque (os públicos, ou os da turma para quem está logado).
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
  1 pergunta. A estrela marca favorito e também serve de filtro. A disciplina vem do cadastro de
  disciplinas do professor (as que eram texto livre viraram cadastro); turma é texto livre e opcional; dificuldade aparece no card e filtra a lista. Tempo e pontuação do
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

- **Histórico do estudante:** mostra só as partidas jogadas com a conta (convidado não tem
  histórico); ficam de fora salas canceladas e participações de quem saiu ou foi removido.
  "Partidas" conta todas, "Recorde" é a maior pontuação numa partida e "Pts totais" é a soma.
  Lista de 10 em 10 ("Carregar mais"). Partida em curso volta para o jogo (de qualquer aparelho);
  partida encerrada abre um resumo com posição, acertos e cada pergunta.
- **Perfil:** nome de exibição (em branco usa o nome de usuário, que é o login e não muda), cor do
  avatar (6 opções), e-mail (trocar pede a senha atual) e "sobre mim" (até 200 caracteres). Há
  também "Alterar senha". O professor tem a mesma tela dentro do painel, sem histórico.
- **Disciplinas:** cada professor tem as suas, sem repetir nome (sem diferenciar maiúsculas e
  acentos digitados de outro jeito). São cadastradas pelo modal "Cadastrar disciplina" (no material
  e no quiz). Disciplina com materiais não pode ser excluída; excluir deixa os quizzes sem disciplina.
- **Turmas:** o professor cria a turma e coloca os alunos buscando por nome, usuário ou e-mail, ou
  passa o código de 6 caracteres para o aluno entrar sozinho em Perfil → Minhas turmas. O aluno
  pode sair da turma. "Gerar novo código" invalida o anterior.
- **Quem vê cada material:** só materiais publicados. Marcado como **Público**, qualquer pessoa vê,
  até sem conta; marcado para turmas, só os alunos delas. Para publicar é preciso escolher ao menos
  uma turma ou "Público". "Todas as minhas turmas" marca as turmas que existem agora.
- **Material:** tipos vídeo (link, duração opcional), documento (arquivo) e artigo (link, tempo de
  leitura opcional). Vídeo do YouTube toca dentro do Sabiá e, sem capa, usa a imagem do vídeo. Capa
  opcional (JPG, PNG ou WEBP até 5 MB). "Tirar do ar" volta para rascunho; excluir apaga arquivo e capa.
- **Visualizações e concluído:** abrir o material conta 1 visualização por aluno logado (visitante
  e o próprio professor não contam). Se o professor permitir, o aluno marca "Concluído" (e pode
  desmarcar); o professor ainda não vê quem concluiu (fica para o dashboard).
- **Dashboard do professor:** "Olá, <primeiro nome>!". Total de perguntas (do banco), jogos ativos
  (partidas já começadas e não terminadas), aguardando (salas abertas esperando "Iniciar") e
  concluídos (todas as partidas encerradas). "Jogos recentes" mostra as 3 últimas partidas, sem as
  canceladas; "Ver mais" abre "Minhas partidas" (10 por página, filtro por situação e busca por nome
  ou PIN). Partida ativa volta para o telão; partida terminada abre o relatório (pódio, ranking
  completo e acerto por pergunta). "Iniciar sessão ao vivo" escolhe um quiz publicado. No celular,
  as partidas viram faixas coloridas empilhadas.
- **Busca do topo do painel:** quizzes do professor e alunos das turmas dele (pelo menos 2 letras).
- **Quem concluiu:** o card do material mostra "X concluíram" e abre a lista de estudantes.
- **Continue aprendendo:** primeiro os materiais das disciplinas das partidas que o aluno jogou,
  depois os mais novos. Busca por título, descrição ou disciplina e filtro por formato.

## API de autenticação (`/api/auth/`)

| Método | Rota | O que faz |
|---|---|---|
| POST | `cadastro/` | Cria a conta (`perfil`: estudante ou professor) e devolve os tokens |
| POST | `entrar/` | Login por usuário ou e-mail; devolve `access`, `refresh` e `usuario` |
| POST | `renovar/` | Troca o `refresh` por um novo `access` |
| POST | `sair/` | Invalida o `refresh` |
| GET/PATCH | `eu/` | Dados do usuário logado / edição do perfil (`email` exige `senha_atual`) |
| POST | `alterar-senha/` | Troca a senha (`senha_atual`, `senha`, `confirmar_senha`) |
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
| GET | `/api/quizzes/` | Lista paginada (6 por página). Filtros: `busca`, `disciplina` (id), `status`, `dificuldade`, `favorito=true`, `pagina` |
| POST | `/api/quizzes/` | Cria; `perguntas_ids` define as perguntas e a ordem; `disciplina_id` vem do cadastro |
| GET/PATCH/DELETE | `/api/quizzes/<id>/` | Detalhe (com `perguntas` completas e `pode_iniciar`), edição e exclusão |
| POST | `/api/quizzes/<id>/duplicar/` | Cópia em rascunho, com cópias das perguntas |
| PATCH | `/api/quizzes/<id>/perguntas/<pergunta_id>/` | Lápis: edita a pergunta só neste quiz |

## Disciplinas e turmas

| Método | Rota | O que faz |
|---|---|---|
| GET/POST | `/api/disciplinas/` | (professor) Lista e cadastra disciplinas |
| PATCH/DELETE | `/api/disciplinas/<id>/` | Renomeia; exclui (409 se tiver materiais) |
| GET/POST | `/api/turmas/` | (professor) Lista (com `codigo` e `alunos_total`) e cria turmas |
| GET/PATCH/DELETE | `/api/turmas/<id>/` | Detalhe com `alunos`, renomear e excluir |
| POST | `/api/turmas/<id>/alunos/` | Adiciona um estudante: `aluno_id` |
| DELETE | `/api/turmas/<id>/alunos/<aluno_id>/` | Tira o estudante da turma |
| POST | `/api/turmas/<id>/novo_codigo/` | Troca o código da turma |
| GET | `/api/alunos/?busca=` | (professor) Busca estudantes por nome, usuário ou e-mail (até 8) |
| GET | `/api/minhas-turmas/` | (estudante) Turmas em que ele está |
| POST | `/api/minhas-turmas/entrar/` | Entra com o `codigo` |
| DELETE | `/api/minhas-turmas/<id>/` | Sai da turma |

## Materiais de estudo

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/materiais/` | (professor) Lista paginada (6). Filtros: `busca`, `disciplina` (id), `tipo`, `status`, `pagina` |
| GET | `/api/materiais/resumo/` | Números do topo: publicados, rascunhos, vídeos, documentos, artigos |
| POST | `/api/materiais/` | Cria (multipart): `titulo`, `descricao`, `disciplina`, `tipo`, `arquivo` ou `url`, `duracao` ("mm:ss"), `tempo_leitura`, `capa`, `publico`, `turmas_ids` ("1,2"), `status`, `permitir_concluir` |
| GET/PATCH/DELETE | `/api/materiais/<id>/` | Detalhe, edição (também "Tirar do ar"/"Publicar" pelo `status`) e exclusão |
| GET | `/api/estudo/` | (qualquer pessoa) "Continue aprendendo": `busca`, `tipo`, `pagina` |
| GET | `/api/estudo/<id>/` | Abre o material e conta a visualização |
| POST/DELETE | `/api/estudo/<id>/concluir/` | (logado) Marca ou desmarca como concluído |

## Dashboard e partidas (só professores)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/painel/` | `perguntas_total`, `jogos_ativos`, `aguardando`, `concluidos` e as 3 partidas `recentes` |
| GET | `/api/painel/busca/?q=` | Busca do topo: `quizzes` e `alunos` (com a turma) |
| GET | `/api/partidas/` | "Minhas partidas" (10 por página): `situacao` (aguardando, em_andamento, finalizado), `busca`, `pagina` |
| GET | `/api/partidas/<id>/relatorio/` | Relatório da partida encerrada (409 se ainda estiver ativa) |
| GET | `/api/materiais/<id>/conclusoes/` | Estudantes que concluíram o material |

## Histórico do estudante

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/historico/` | Resumo (`partidas`, `recorde`, `pontos_totais`) + partidas, 10 por página |
| GET | `/api/historico/<id>/` | Resumo de uma partida encerrada, com cada pergunta |
| POST | `/api/historico/<id>/retomar/` | Chave para voltar a uma partida em curso |

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

- Rodapé da página inicial: o mockup traz "News", "Blog", "Webinars", "Actimo" e "Motimate",
  mas eles ainda não têm endereço. Ficaram de fora até o Projeto Sinergy passar os links; o
  rodapé mostra Criar conta, Materiais, Jogar, Como funciona e o e-mail sinergy@ufrn.com.br.

- A fonte **PP Telegraf** do mockup é comercial e não está no Google Fonts; o projeto cai
  para Outfit até a licença ser adicionada em `frontend/src/estilos/tokens.css`.
- Os arquivos enviados (PDFs e capas) ficam em `backend/media/` e são servidos pelo Django só
  com `DJANGO_DEBUG=true`. Em produção, eles precisam de um servidor de arquivos (ou de um
  armazenamento como S3). Quem tiver o link do arquivo consegue abri-lo.
