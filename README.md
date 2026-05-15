# 🌟 Nova Learn — AI-Powered Tutoring Platform
https://github.com/user-attachments/assets/ac514b99-c60e-49f0-98d5-c42ec050e347
> *An intelligent, adaptive learning companion that brings personalised education to every student.*

Nova Learn is a full-stack AI tutoring platform that combines interactive quizzes, concept mapping, real-time AI chat, and teacher tools into one seamless experience. Students explore subjects at their own pace, while teachers can assign quizzes, track progress, and identify knowledge gaps.

---

## 🏗 Architecture

The platform runs **four independent services** that work together:

| Service                    | Tech                         | Port | Purpose                              |
| -------------------------- | ---------------------------- | ---- | ------------------------------------ |
| **Frontend**               | TanStack Start, React, Vite  | 5173 | SSR web app — UI, routing, state     |
| **Backend API**            | Flask, MongoDB, JWT          | 5000 | Auth, curriculum, quizzes, tracking  |
| **Scrapper**               | FastAPI, DuckDuckGo, yt-dlp  | 8080 | Educational media search (images, videos, links) |
| **Chatbot LLM**            | FastAPI, Ollama, Gemini      | 8000 | Streaming AI tutor with multi-model fallback |

```
┌─────────┐    /api/*     ┌────────────┐    ┌──────────┐
│ Browser │ ────────────▶ │  Flask API  │ ──▶│ MongoDB  │
│ :5173   │               │  :5000      │    └──────────┘
└────┬────┘               └────────────┘
     │ /imglinks           ┌────────────┐
     ├───────────────────▶ │  Scrapper  │
     │ /ytlinks            │  :8080     │
     │ /shaalaalinks       └────────────┘
     │ /llm                ┌────────────┐      ┌──────────┐
     └───────────────────▶ │ Chatbot LLM│ ────▶│  Ollama  │
                          │  :8000      │ └────│  Gemini  │
                          └────────────┘       └──────────┘
```

---

## ✨ Features

- **🎨 Interactive Dashboard** — Subject list, progress tracking, concept graphs
- **🤖 AI Tutor Chat** — Streaming responses with `/thinking` deep reasoning and `/diagrams` visual aids
- **📝 Smart Quizzes** — Teacher-created quizzes with deadlines, auto-grading, and class leaderboards
- **🔗 Concept Knowledge Graph** — Visual dependency map of chapters with D3 force-directed layout
- **📚 Curriculum Browser** — Grade & board filtered subject/chapter content with PDF support
- **🧠 Personalised Assessment** — Adaptive quick quizzes that identify weak areas
- **📓 Notebook** — Built-in notes with auto-synced chat history
- **👩‍🏫 Teacher Tools** — Quiz creation, student result analysis, gap detection
- **🌙 Dark / Light Mode** — Theme toggle with persistent preference
- **🔍 Spell Checker** — Levenshtein-based word suggestions with keyboard smash detection
- **🛡️ Input Guard** — Abusive language filter, keyboard smash detector, spelling hints

---

## 📋 Prerequisites

| Tool            | Version   | Notes                              |
| --------------- | --------- | ---------------------------------- |
| **Python**      | ≥ 3.12    | Required for all backend services  |
| **Node.js**     | ≥ 18      | Required for frontend              |
| **npm** or **bun** | ≥ 10   | Package manager for frontend       |
| **uv**          | ≥ 0.5     | Fast Python package manager (recommended) |
| **Ollama**      | latest    | Local LLM for chatbot (optional, falls back to Gemini) |
| **MongoDB**     | ≥ 6.0     | Database (local or Atlas)          |

> *Ollama is optional* — if unavailable, the chatbot automatically falls back to Google Gemini (configured via `GEMINI_API_KEYS`).

---

## 🚀 Quick Start

### 1. Clone and enter the project

```bash
git clone [<repo-url> TISD-Final](https://github.com/Halfgods/Learn-Bridge.git)
cd Learn-Bridge
```

### 2. Environment Variables

Copy or edit `Backend/.env` with your credentials:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/aitutor?retryWrites=true&w=majority
JWT_SECRET=<your-secret-key>
GEMINI_API_KEYS=<comma-separated-keys>
OLLAMA_MODELS_DEFAULT=llama3.1:8b,gemma3:12b
OLLAMA_MODELS_THINKING=deepseek-r1:latest
OLLAMA_ALLOW_GENERATE_FALLBACK=1
```

### 3. Backend API (Flask — Port 5000)

```bash
cd Backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install flask flask-cors pymongo PyJWT requests uvicorn ddgs yt-dlp google-genai fastapi



# Or using uv (recommended, faster):
uv sync

# Install Node dependencies (for seed scripts)
npm install

# Start the server
python main.py
```

### 4. Scrapper (FastAPI — Port 8080)

```bash
cd Backend/Scrapper

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install fastapi uvicorn requests ddgs yt-dlp

# Or using uv:
uv sync

# Start the server
python main.py
```

### 5. Chatbot LLM (FastAPI — Port 8000)

```bash
cd Backend/Chatbot_LLM

# Create virtual environment (or use Backend's .venv)
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install fastapi uvicorn httpx google-genai python-dotenv

# Install Ollama models (optional)
ollama pull llama3.2:3b
ollama pull llama3.1:8b
ollama pull deepseek-r1:latest

# Start the server
python main.py
```

### 6. Frontend (Vite — Port 5173)

```bash
cd Frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

### 7. Open the App

Navigate to [**http://localhost:5173**](http://localhost:5173)

---

## 🎯 One-Command Launch

If you're on **GNOME**, use the provided launcher to start all four services in separate terminals:

```bash
chmod +x runall.sh
./runall.sh
```

Or start the backend suite individually:

```bash
cd Backend
chmod +x run-server.sh
./run-server.sh
```

---

## 🧭 Available Commands

### Frontend

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `npm run dev`      | Start Vite dev server          |
| `npm run build`    | Production build               |
| `npm run preview`  | Preview production build       |
| `npm run lint`     | Run ESLint                     |
| `npm run format`   | Format with Prettier           |

### Chatbot Commands (in the chat panel)

| Command            | Description                             |
| ------------------ | --------------------------------------- |
| `/thinking`        | Deep reasoning mode (uses DeepSeek)     |
| `/diagrams`        | Include visual diagrams with the answer |
| `/quiz`            | Generate a 5-question MCQ quiz          |

---

## 🌐 API Overview

### Backend API (`/api/*` → Port 5000)

| Endpoint                          | Method | Description                    |
| --------------------------------- | ------ | ------------------------------ |
| `/api/auth/register`              | POST   | Register a new user            |
| `/api/auth/login`                 | POST   | Login, returns JWT             |
| `/api/auth/me`                    | GET    | Current user profile           |
| `/api/auth/become-teacher`        | POST   | Upgrade student to teacher     |
| `/api/curriculum/classes`         | GET    | List all grades/classes        |
| `/api/curriculum/class/<std>/subjects` | GET | Subjects for a grade       |
| `/api/teacher/quizzes`            | GET    | Teacher's created quizzes      |
| `/api/teacher/quizzes`            | POST   | Create a new quiz              |
| `/api/teacher/quizzes/<id>/attempts` | GET | Student attempts for a quiz  |
| `/api/student/quiz-assignments`   | GET    | Quizzes assigned to student    |
| `/api/knowledge-graph`            | GET    | Chapter dependency graph       |
| `/api/knowledge-graph/gaps`       | GET    | Identified knowledge gaps      |
| `/api/assessment/random`          | GET    | Random assessment questions    |
| `/api/chat/sessions`              | GET    | List saved chat sessions       |
| `/api/chat/sessions`              | POST   | Save a chat session            |
| `/api/chat/sessions/<id>`         | GET    | Get a specific session         |
| `/api/chat/sessions/<id>`         | DELETE | Delete a session               |

### Scrapper API (`/imglinks`, `/ytlinks`, `/shaalaalinks` → Port 8080)

| Endpoint          | Method | Parameters        | Description                    |
| ----------------- | ------ | ----------------- | ------------------------------ |
| `/imglinks`       | GET    | `query`           | Image search (DuckDuckGo + Wikimedia fallback) |
| `/ytlinks`        | GET    | `query`, `std`    | Video search (DuckDuckGo + yt-dlp fallback)   |
| `/shaalaalinks`   | GET    | `query`           | Educational link search                       |

### Chatbot LLM API (`/llm` → Port 8000)

| Endpoint              | Method | Description                        |
| --------------------- | ------ | ---------------------------------- |
| `/chat`               | POST   | Streaming chat (NDJSON)            |
| `/chat/sync`          | POST   | Non-streaming chat                 |
| `/chat/history`       | GET    | Get session history                |
| `/chat/history/clear` | POST   | Clear session history              |

---

## 🧠 AI Tutor Details

The chatbot intelligently routes queries based on content:

| Query Type    | Model Used                 | Behaviour                              |
| ------------- | -------------------------- | -------------------------------------- |
| General       | `llama3.1:8b` (Ollama)     | Standard tutoring response             |
| Deep Research | `deepseek-r1:latest`       | Step-by-step reasoning with thinking trace |
| Long / Complex| Larger available model     | Detailed explanations                  |
| Summarisation | Fast model                 | Concise summaries                      |

**Fallback chain**: Ollama primary → Ollama fallback → Google Gemini cloud

**Guard system** (`guard.py`):
- **Abusive language** — Blocks offensive content
- **Keyboard smash** — Detects gibberish like `fajfafba` via Levenshtein distance + bigram analysis
- **Spell checker** (`spellcheck.py`) — Dictionary of 2000+ academic words, suggests corrections via Levenshtein distance (max edit distance 2)
- **Spelling hints** — Returned as a `notice` before the AI response

---

## 🛠 Tech Stack

### Frontend
- **React 19** + **TypeScript**
- **TanStack Start** (SSR) + **TanStack Router** (file-based routing)
- **TanStack Query** (server state)
- **Vite** (bundler)
- **Tailwind CSS 4** + **shadcn/ui** (components)
- **D3.js** (concept graph visualisation)
- **Recharts** (charts)
- **Lucide Icons**

### Backend
- **Flask** (main API server)
- **FastAPI** (scrapper & chatbot servers)
- **MongoDB** + **PyMongo** (database)
- **JWT** (authentication)
- **Ollama** (local LLM)
- **Google Gemini API** (cloud fallback)

### Scrapper
- **DuckDuckGo Search** (images, videos, links)
- **Wikimedia Commons** (image fallback)
- **yt-dlp** (video fallback)

---

## 🔧 Troubleshooting

| Symptom                           | Likely Cause                           | Fix                              |
| --------------------------------- | -------------------------------------- | -------------------------------- |
| Chat returns "Nova is thinking…"  | Ollama not running or model not pulled | `ollama pull llama3.1:8b`        |
| 403 on `/api/teacher/quizzes`     | Logged in as student, not teacher      | Use a teacher account or `/api/auth/become-teacher` |
| `/quiz` returns "not a real question" | Guard rejecting due to low character diversity | Update `guard.py` thresholds |
| Images not showing for `/diagrams` | Scrapper server not running            | Start Scrapper on port 8080      |
| CORS errors                       | Backend origin list missing your port  | Add port to `ALLOWED_ORIGINS`    |
| `ObjectId` not JSON serializable  | MongoDB `_id` in response              | Filter `_id` from queries        |
| Chat history not appearing        | Session list not refreshed             | Click History button again (now auto-refreshes) |

---

## 📁 Project Structure

```
TISD-Final/
├── Backend/
│   ├── main.py                 # Flask API (auth, quizzes, curriculum)
│   ├── .env                    # Environment variables
│   ├── pyproject.toml          # Python dependencies (uv)
│   ├── package.json            # Node deps (seed scripts)
│   ├── run-server.sh           # Backend startup script
│   ├── Chatbot_LLM/
│   │   ├── main.py             # FastAPI streaming AI tutor
│   │   ├── guard.py            # Input validation
│   │   └── spellcheck.py       # Spell checker with Levenshtein
│   └── Scrapper/
│       ├── main.py             # FastAPI content aggregation
│       ├── Scripts/
│       │   ├── images.py       # DuckDuckGo image search
│       │   ├── imagefallback.py # Wikimedia fallback
│       │   ├── videos.py       # DuckDuckGo video search
│       │   ├── videosfallback.py # yt-dlp fallback
│       │   └── links.py        # DuckDuckGo link search
│       └── README.md           # Scrapper documentation
├── Frontend/
│   ├── package.json            # React / Vite dependencies
│   ├── vite.config.ts          # Vite config + proxy rules
│   ├── src/
│   │   ├── routes/             # TanStack Router file-based routes
│   │   ├── components/         # UI components (ChatbotPanel, ConceptMap, etc.)
│   │   ├── hooks/              # Custom hooks (useMe)
│   │   ├── lib/                # Utilities (api, utils)
│   │   └── styles.css          # Global styles + dark mode
│   └── components.json         # shadcn/ui configuration
├── runall.sh                   # Launch all services (GNOME)
└── README.md                   # This file
```

---

## 📄 License

This project is built for educational purposes. See individual service directories for license details.
