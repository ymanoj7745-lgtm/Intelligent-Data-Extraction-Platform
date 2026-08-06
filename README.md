# 🤖 AI-Powered Customer Complaint Management System

An intelligent, full-stack complaint management platform built for pharmaceutical/product quality workflows. It uses **LLM-driven agents (LangGraph + Groq/Llama 3.3)** to automatically extract structured complaint data from unstructured PDFs or free text, and to generate real-time **AI risk assessments** with actionable recommendations — cutting down manual QMS (Quality Management System) triage time.

<p>
  <img alt="Python" src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-Async-009688?logo=fastapi&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="LangGraph" src="https://img.shields.io/badge/LangGraph-Agentic%20Workflows-1C3C3C">
  <img alt="Groq" src="https://img.shields.io/badge/LLM-Llama%203.3%2070B%20(Groq)-F55036">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Async-4169E1?logo=postgresql&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## 📖 Overview

Traditional complaint intake in regulated industries (pharma, manufacturing, consumer goods) is slow and manual — someone has to read a complaint letter or PDF, manually key in the product name, batch number, severity, and complaint type, then separately judge how risky the issue is.

This system automates both steps with a two-agent AI pipeline:

1. **Extraction Agent** — parses a raw complaint (PDF upload or pasted text) and returns clean, structured JSON (product, batch number, complaint type, severity, description, received date), which pre-fills the intake form.
2. **Risk Assessment Agent** — analyzes the logged complaint and returns a risk level (Low → Critical), a justification, and a list of recommended corrective actions — acting as an AI "copilot" for quality teams.

Complaints are then persisted to a Postgres database via an async FastAPI backend, and reviewed through a clean React dashboard.

---

## ✨ Key Features

- 📄 **AI Document Extraction** — Upload a complaint PDF or paste raw text; an LLM agent extracts structured fields automatically (no manual data entry).
- 🚦 **AI Risk Assessment Copilot** — One-click risk scoring (Low/Medium/High/Critical) with a written justification and recommended corrective actions.
- 🧠 **Agentic Workflows with LangGraph** — Extraction and risk-assessment logic are modeled as explicit state graphs (`StateGraph`), making each pipeline traceable, testable, and easy to extend with new nodes (e.g., root-cause analysis, CAPA generation).
- ⚡ **Fast, Free-Tier LLM Inference** — Uses Groq's hosted `llama-3.3-70b-versatile` for low-latency structured JSON generation.
- 🗄️ **Async Persistence** — FastAPI + SQLAlchemy (async) + `asyncpg` for non-blocking database access.
- 🎨 **Modern React Dashboard** — Redux Toolkit for state management, Tailwind CSS for styling; a single-page dashboard with an intake panel, editable complaint form, and AI copilot side panel.

---

## 🏗️ Architecture

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│           Frontend           │         │              Backend             │
│   React 19 + Redux Toolkit   │  HTTP   │            FastAPI (async)        │
│                              │ ──────► │                                   │
│  ┌────────────────────────┐  │         │  POST /extract                    │
│  │ ComplaintIntake.js      │──┼────────┼─►  Extraction Agent (LangGraph)   │
│  │  (PDF / text upload)    │  │         │     └─ Groq Llama 3.3 70B         │
│  └────────────────────────┘  │         │                                   │
│  ┌────────────────────────┐  │         │  POST /risk-assessment            │
│  │ AiCopilotPanel.js       │──┼────────┼─►  Risk Agent (LangGraph)         │
│  │  (risk scoring UI)      │  │         │     └─ Groq Llama 3.3 70B         │
│  └────────────────────────┘  │         │                                   │
│  ┌────────────────────────┐  │         │  POST /complaints                 │
│  │ ComplaintForm.js        │──┼────────┼─►  Async SQLAlchemy ORM           │
│  │  (log / edit / save)    │  │         │     └─ PostgreSQL (asyncpg)       │
│  └────────────────────────┘  │         │                                   │
└─────────────────────────────┘         └──────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer            | Technology                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| Frontend          | React 19, Redux Toolkit, Tailwind CSS, Axios                                |
| Backend           | FastAPI (async), Pydantic, Uvicorn                                          |
| AI / Agents       | LangGraph, LangChain, Groq (`llama-3.3-70b-versatile`)                      |
| Database          | PostgreSQL, SQLAlchemy (async ORM), `asyncpg`                               |
| Document Parsing  | PyPDF2                                                                       |
| Tooling           | python-dotenv, python-multipart                                             |

---

## 📂 Project Structure

```
AI-Powered-Customer-Complaint-Management-System/
├── backend/
│   ├── main.py                  # FastAPI app & route definitions
│   ├── models.py                # SQLAlchemy ORM models (Complaint)
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── requirements.txt
│   ├── api/                      # (route modules — extraction, risk, copilot)
│   └── workflows/
│       ├── extraction.py         # LangGraph extraction agent
│       └── risk.py               # LangGraph risk-assessment agent
│
└── frontend/
    ├── package.json
    ├── src/
    │   ├── App.js                 # Main dashboard layout
    │   ├── store.js                # Redux store configuration
    │   ├── complaintSlice.js       # Complaint form state
    │   ├── aiSlice.js               # AI risk/completeness state
    │   └── components/
    │       ├── ComplaintIntake.js   # PDF/text upload → AI extraction
    │       ├── ComplaintForm.js      # Manual complaint entry & save
    │       └── AiCopilotPanel.js      # AI risk assessment panel
    └── public/
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- A PostgreSQL database (local or hosted, e.g. [Neon](https://neon.tech))
- A [Groq API key](https://console.groq.com) (free tier available)

### 1. Clone the repository

```bash
git clone https://github.com/ymanoj7745-lgtm/AI-Powered-Customer-Complaint-Management-System.git
cd AI-Powered-Customer-Complaint-Management-System
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```env
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>/<dbname>
GROQ_API_KEY=your_groq_api_key_here
```

> ⚠️ **Note:** The current `workflows/extraction.py` and `workflows/risk.py` read the Groq key via `os.getenv(...)`. Double-check the environment-variable name used in your local copy matches your `.env` key before running (it should reference `GROQ_API_KEY`).

Run the API server:

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

### 3. Frontend setup

```bash
cd ../frontend
npm install
npm start
```

The dashboard will be available at `http://localhost:3000`.

---

## 🔌 API Reference

| Method | Endpoint             | Description                                                              |
|--------|-----------------------|---------------------------------------------------------------------------|
| `POST` | `/extract`            | Accepts a PDF file or raw text; returns AI-extracted structured complaint data. |
| `POST` | `/risk-assessment`    | Accepts complaint data; returns AI risk level, justification, and recommended actions. |
| `POST` | `/complaints`         | Persists a complaint record to the database.                             |

**Example — extract complaint data from text**

```bash
curl -X POST http://localhost:8000/extract \
  -F "text=Batch #A102 of ProductX arrived with a cracked seal, received 2026-07-01."
```

**Example — risk assessment**

```bash
curl -X POST http://localhost:8000/risk-assessment \
  -H "Content-Type: application/json" \
  -d '{"product_name":"ProductX","batch_number":"A102","complaint_type":"Packaging","severity":"Medium","description":"Cracked seal on arrival"}'
```

---

## 🖼️ Screenshots

**Dashboard — AI Document Extraction, Complaint Logging & AI Copilot**

![Dashboard Screenshot](./docs/screenshots/dashboard.png)

The dashboard combines three panels: drag-and-drop AI document extraction (left), the editable complaint form pre-filled from extracted data (bottom-left), and the AI Copilot risk assessment panel (right), which returns a risk level, justification, and recommended actions in real time.

---

## 🗺️ Roadmap

- [ ] Root-cause analysis agent (extend the LangGraph risk pipeline)
- [ ] Automated CAPA (Corrective and Preventive Action) suggestion node
- [ ] Authentication & role-based access (QA reviewer vs. submitter)
- [ ] Complaint analytics dashboard (trends by product/severity/type)
- [ ] Dockerized deployment (backend + frontend + Postgres via Compose)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👤 Author

**Manoj Yadav**
AI/ML Engineer

- GitHub: [@ymanoj7745-lgtm](https://github.com/ymanoj7745-lgtm)
- LinkedIn: [ymanoj7745](https://linkedin.com/in/ymanoj7745)
- Email: ymanoj7745@gmail.com
