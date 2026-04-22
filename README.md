# UniBot - College Support Chatbot

UniBot is a full-stack college support chatbot project.
It combines a React frontend, a Node.js/Express backend, and a FastAPI AI service that can run Retrieval-Augmented Generation (RAG) with Gemini + Pinecone.

The system supports:
- Student and admin authentication
- Student information workflows (courses, fees, schedule, conversations)
- Admin document and FAQ management
- AI-powered responses with rule-based fallback when AI services are unavailable
- Evaluation endpoints for response quality checks

## Architecture

- Frontend: React + Vite (default local port: 3000)
- Backend API: Node.js + Express + MongoDB (default local port: 5000)
- AI Service: FastAPI + Gemini + Pinecone (default local port: 8000)

Request flow:
1. User interacts with the React app.
2. Frontend calls the Express backend.
3. Backend calls the FastAPI AI service for RAG-based chat/document processing.
4. If AI service is unavailable, backend falls back to rule-based chatbot responses.

## Tech Stack

- Frontend: React, Vite, React Router, Zustand, Axios
- Backend: Express, Mongoose, JWT, Winston, Jest
- AI Service: FastAPI, Uvicorn, LangChain, Gemini API, Pinecone
- Database: MongoDB

## Main Folders

- `frontend/` - React client
- `backend/` - Express API and MongoDB models
- `ai_service/` - FastAPI AI/RAG service
- `knowledge_base/` - Text knowledge files used for domain content

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- MongoDB (local or cloud)
- API keys for full RAG mode:
  - Gemini API key
  - Pinecone API key

## Setup and Run

Open 3 terminals and follow the steps below.

### 1) Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/college_chatbot
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000

# AI service connection
AI_SERVICE_URL=http://localhost:8000
AI_TIMEOUT_MS=30000
```

Run backend:

```bash
npm run dev
```

### 2) AI Service Setup

```bash
cd ai_service
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `ai_service/.env`:

```env
# Required for full RAG mode
GEMINI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key

# Optional / defaults
PINECONE_INDEX_NAME=college-chatbot
PINECONE_ENVIRONMENT=us-east-1
MONGODB_URI=mongodb://localhost:27017/college_chatbot

AI_SERVICE_HOST=0.0.0.0
AI_SERVICE_PORT=8000
LOG_LEVEL=INFO

# Keep aligned with backend API URL
BACKEND_URL=http://localhost:5000

# Models and retrieval tuning
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=768
GENERATION_MODEL=gemini-2.5-flash
TOP_K_RETRIEVAL=5
CHUNK_SIZE=800
CHUNK_OVERLAP=120
MIN_RELEVANCE_SCORE=0.45
INTERNAL_API_KEY=internal_secret_key_2025
```

Run AI service:

```bash
python main.py
```

Alternative:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3) Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Run frontend:

```bash
npm run dev
```

App URL: `http://localhost:3000`

## Optional: Seed Development Data

From `backend/`:

```bash
npm run seed
```

Seed script creates sample users and data (including admin and student demo accounts).

## Useful Endpoints

- Backend API health: `GET http://localhost:5000/api/health`
- Backend root: `GET http://localhost:5000/`
- AI health: `GET http://localhost:8000/health`
- AI docs (Swagger): `http://localhost:8000/docs`

## Testing

Backend tests:

```bash
cd backend
npm test
```

Frontend tests:

```bash
cd frontend
npm run test
```

AI service tests:

```bash
cd ai_service
python -m pytest tests
```

If `pytest` is not available, install it in the virtual environment:

```bash
pip install pytest
```

## Troubleshooting

- If frontend cannot reach backend, verify `frontend/.env` has the correct `VITE_API_URL`.
- If backend cannot start, check `MONGODB_URI` and make sure MongoDB is running.
- If AI health shows unavailable services, verify `GEMINI_API_KEY` and `PINECONE_API_KEY`.
- If chat still works but AI is down, that is expected: backend uses a rule-based fallback.

## Notes

- Active app folders are `frontend/`, `backend/`, and `ai_service/`.
- The workspace also contains archived or interim folders that are not required for the main run flow.