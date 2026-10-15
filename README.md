# Task Manager

A full-stack task board with drag-and-drop columns, due dates, priorities, search, activity history, and CSV export. The React interface uses a Flask API backed by PostgreSQL.

## Stack

React · Vite · Flask · PostgreSQL

## Run locally

### 1. Start PostgreSQL

Create a database and set its connection URL in the backend environment. Keep the URL and any credentials out of Git.

```text
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
DB_SSLMODE=prefer
```

For a hosted database that requires TLS, set `DB_SSLMODE=require`.

### 2. Start the API

```bash
cd backend
python -m venv .venv
```

Activate the environment, then install and initialize:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python init_db.py
flask --app app run --debug
```

The API runs at `http://127.0.0.1:5000`.

### 3. Start the frontend

In another terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env.local` with the local API endpoint:

```text
VITE_API_URL=http://127.0.0.1:5000/api/todos
```

Then run:

```bash
npm run dev
```

Vite prints the local URL. The frontend defaults to the deployed API when `VITE_API_URL` is not set.

## API

- `GET /api/todos` — list tasks
- `POST /api/todos` — create a task
- `PUT /api/todos/<id>` — update a task
- `PUT /api/todos/<id>/toggle-reminder` — update reminder setting
- `DELETE /api/todos/<id>` — delete a task

## Repository layout

- `backend/` — Flask API, PostgreSQL connection, and schema initialization
- `frontend/` — React and Vite task board

Keep virtual environments, build output, and database credentials out of version control.
