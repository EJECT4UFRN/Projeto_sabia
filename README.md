# Sabiá

Plataforma de quiz ao vivo para escolas, desenvolvida pela EJECT para o Projeto Sinergy.
O professor cria perguntas e quizzes, abre uma sala com PIN e projeta as perguntas; os
estudantes entram pelo PIN (com conta ou como convidado) e respondem pelo celular.

- **Backend:** Django 5.1 + Django REST Framework, JWT (simplejwt), Channels + Redis para o tempo real
- **Frontend:** React 19 + Vite, React Router, CSS Modules
- **Banco:** PostgreSQL

Mockup de referência: Figma "Sabiá - Projeto Sinergy - EJECT".

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
  já a usam. Pergunta que já está em algum quiz pode ser editada, mas não excluída (essa trava
  entra junto com os quizzes).

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

## Estrutura

```
backend/    Django (config/ = projeto, um app por domínio)
frontend/   React (src/componentes, src/paginas, src/estilos/tokens.css)
docker-compose.yml
```

## Pendências conhecidas

- A fonte **PP Telegraf** do mockup é comercial e não está no Google Fonts; o projeto cai
  para Outfit até a licença ser adicionada em `frontend/src/estilos/tokens.css`.
