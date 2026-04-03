# Adventure-AI 🗺️

An AI-powered choose-your-own-adventure story generator. Enter a theme, and the app generates a full branching narrative with multiple paths, decisions, and endings — then lets you play through it interactively.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [API Reference](#api-reference)
- [How It Works](#how-it-works)
- [Bug Fixes Applied](#bug-fixes-applied)
- [Known Limitations](#known-limitations)

---

## Architecture Overview

```
Browser (React)
     │
     │  /api/*  (Vite proxy in dev)
     ▼
FastAPI Backend  ──►  Groq LLM (llama-3.3-70b-versatile)
     │
     ▼
PostgreSQL
```

Story generation is handled asynchronously:

1. `POST /api/stories/create` — immediately returns a **job ID** and queues generation in a background task.
2. Frontend polls `GET /api/jobs/{job_id}` every 3 seconds until the job is `completed` or `failed`.
3. On completion, the frontend navigates to `/story/{id}` where the full story tree is fetched once and rendered as an interactive game.

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 19, Vite 7, React Router 7, Axios |
| Backend   | Python 3.13, FastAPI, SQLAlchemy 2, Uvicorn |
| AI        | LangChain + Groq (`llama-3.3-70b-versatile`) |
| Database  | PostgreSQL (via psycopg2-binary) |

---

## Project Structure

```
Adventure-AI/
├── backend/
│   ├── core/
│   │   ├── config.py          # Pydantic settings (reads .env)
│   │   ├── models.py          # Pydantic models for LLM response parsing
│   │   ├── prompts.py         # Story generation prompts
│   │   └── story_generator.py # LangChain + Groq story generation logic
│   ├── db/
│   │   └── database.py        # SQLAlchemy engine, session, Base
│   ├── models/
│   │   ├── job.py             # StoryJob ORM model
│   │   └── story.py           # Story + StoryNode ORM models
│   ├── routers/
│   │   ├── job.py             # GET /api/jobs/{job_id}
│   │   └── story.py           # POST /api/stories/create, GET /api/stories/{id}/complete
│   ├── schemas/
│   │   ├── job.py             # Pydantic response schemas for jobs
│   │   └── story.py           # Pydantic response schemas for stories
│   ├── main.py                # FastAPI app entrypoint
│   ├── pyproject.toml
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ThemeInput.jsx     # Landing page — theme entry form
    │   │   ├── LoadingStatus.jsx  # Spinner shown while job is processing
    │   │   ├── StoryGenerator.jsx # Orchestrates creation + polling
    │   │   ├── StoryLoader.jsx    # Fetches a story by ID and renders the game
    │   │   └── StoryGame.jsx      # Interactive choose-your-own-adventure UI
    │   ├── util.js                # Shared constants (API_BASE_URL)
    │   ├── App.jsx
    │   └── main.jsx
    ├── vite.config.js             # Dev proxy: /api → localhost:8000
    └── package.json
```

---

## Prerequisites

- **Node.js** ≥ 20.19.0
- **Python** 3.13
- **PostgreSQL** running locally (or a connection string to a remote instance)
- A **Groq API key** — get one free at [console.groq.com](https://console.groq.com)

---

## Setup & Installation

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill in the environment file
cp .env.example .env           # see Environment Variables section below
```

### Frontend

```bash
cd frontend

npm install

# Copy and fill in the environment file
cp .env.example .env           # see Environment Variables section below
```

---

## Environment Variables

### `backend/.env`

```env
# SQLAlchemy connection string
DATABASE_URL=postgresql://user:password@localhost:5432/adventure_ai

# Groq API key — https://console.groq.com
GROQ_API_KEY=gsk_...

# Comma-separated list of allowed CORS origins (no trailing slash)
ALLOWED_ORIGINS=http://localhost:5173
```

### `frontend/.env`

```env
# Optional: override the backend host the Vite proxy forwards to.
# Defaults to http://localhost:8000 if not set.
VITE_API_TARGET=http://localhost:8000
```

> **Note:** In development, the Vite dev server proxies all `/api/*` requests to
> the backend, so the frontend code always uses `API_BASE_URL = "/api"` and
> never hard-codes a port. No CORS issues in dev.

---

## Running the App

### 1. Start the database

Make sure PostgreSQL is running and the database exists:

```bash
createdb adventure_ai
```

### 2. Start the backend

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

Tables are created automatically on startup via `create_tables()` in `main.py`.

API docs available at:
- Swagger UI → [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc      → [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/stories/create` | Submit a theme and start async story generation. Returns `{ job_id, status }`. |
| `GET`  | `/api/jobs/{job_id}` | Poll job status. `status` is one of `pending`, `processing`, `completed`, `failed`. On completion, `story_id` is populated. |
| `GET`  | `/api/stories/{story_id}/complete` | Fetch the full story tree — title, root node, and a flat map of all nodes by ID. |

### Story node shape

Each node in `all_nodes` looks like:

```json
{
  "id": 42,
  "content": "You find yourself at a crossroads...",
  "is_ending": false,
  "is_winning_ending": false,
  "options": [
    { "text": "Take the forest path", "node_id": 43 },
    { "text": "Follow the river",     "node_id": 44 }
  ]
}
```

Ending nodes have `is_ending: true` and an empty `options` array.

---

## How It Works

1. **Prompt & Parse** — `StoryGenerator.generate_story()` sends a structured prompt to Groq's `llama-3.3-70b-versatile` model via LangChain. A `PydanticOutputParser` enforces the JSON schema, giving a fully typed `StoryLLMResponse` object.

2. **Persist** — `_process_story_node()` recursively walks the LLM response tree and writes each node to PostgreSQL. Parent–child relationships are encoded in each node's `options` JSON column as `[{ "text": "...", "node_id": <int> }]`.

3. **Play** — The frontend loads the flat `all_nodes` dictionary once and navigates entirely client-side by looking up `node_id` values from option buttons — no extra network requests during gameplay.

---

## Known Limitations

- **Single LLM model** — hard-coded to `llama-3.3-70b-versatile` on Groq. To switch models, edit `StoryGenerator._get_llm()` in `backend/core/story_generator.py`.
- **No user accounts** — stories are tied to an anonymous browser cookie (`session_id`). Clearing cookies or switching browsers loses story history.
- **Story depth** — the prompt targets 3–4 levels deep. Very long or complex themes can occasionally cause the LLM to produce malformed JSON; the background task will mark the job `failed` and surface the error in the UI.