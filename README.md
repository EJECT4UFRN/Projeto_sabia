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

Para criar um professor: `docker compose exec backend python manage.py createsuperuser` e,
no admin, defina o perfil como "Professor".

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

## Estrutura

```
backend/    Django (config/ = projeto, um app por domínio)
frontend/   React (src/componentes, src/paginas, src/estilos/tokens.css)
docker-compose.yml
```

## Pendências conhecidas

- A fonte **PP Telegraf** do mockup é comercial e não está no Google Fonts; o projeto cai
  para Outfit até a licença ser adicionada em `frontend/src/estilos/tokens.css`.
