# Nome do Projeto
> Descrição breve do projeto.

Modelo Monorepo Oficial da EJECT para projetos com **React** (front-end) + **Django REST Framework** (back-end).

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Django](https://img.shields.io/badge/Django-6.0.8-092E20?logo=django&logoColor=white)
![DRF](https://img.shields.io/badge/DRF-3.18.1-A30000?logo=django&logoColor=white)

# Links importantes
- [Mockup]()
- [Pipefy]()

## 📁 Estrutura do Repositório

```
Nome do Projeto/
├── backend/     # API em Django REST Framework (ver backend/README.md)
├── frontend/    # Interface em React + Vite (ver frontend/README.md)
└── README.md    # Este arquivo
```

Cada pasta segue o modelo oficial correspondente:
[MODELO_Django_REST_Framework](https://github.com/EJECT4UFRN/MODELO_Django_REST_Framework) e
[MODELO_Trainee_React](https://github.com/EJECT4UFRN/MODELO_Trainee_React).

## ▶️ Como Rodar

Pré-requisitos: **Python 3.12+** e **Node.js 20+**. Use dois terminais:

```bash
# Terminal 1 - back-end (http://localhost:8000)
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

```bash
# Terminal 2 - front-end (http://localhost:5173)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Teste a integração em `http://localhost:8000/api/status/` (deve responder `{"status": "ok"}`).
O front acessa a API pelo endereço definido em `VITE_API_URL` (`frontend/.env`), via `src/services/api.js`.
O back-end já libera o CORS para `localhost:5173` e `localhost:3000`.

Detalhes de cada parte (Docker, testes, lint, padrões de código) estão nos READMEs de `backend/` e `frontend/`.

## 👥 Equipe

- Membro - Scrum Master
- Membro - PO
- Membro - Dev Frontend
- Membro - Dev Backend

Desenvolvido pela **EJECT - Empresa Júnior da Escola de Ciências e Tecnologia**
