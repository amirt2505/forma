# Forma

**A full-stack project management and team collaboration application.**

Forma is a web application designed to help individuals and teams organize projects, manage tasks, track progress, and communicate in one workspace.

Built with React and FastAPI, Forma combines a responsive interface with a Python backend, relational data models, and authenticated API endpoints.

## Features

- **Project management:** Create and organize projects in a shared workspace.
- **Task tracking:** Manage assignments, priorities, statuses, and deadlines.
- **Personal workspace:** View and organize work assigned to you.
- **Team collaboration:** Work across projects with multiple user accounts.
- **Messaging:** Communicate through direct and group conversations.
- **Milestones:** Organize larger goals and track project progress.
- **Authentication:** Register and sign in using JWT-based authentication.
- **Dashboards:** View project and task information through an interactive interface.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, JavaScript, Vite, CSS |
| Backend | Python, FastAPI |
| Database | SQLAlchemy, SQLite for local development |
| Authentication | JWT, password hashing |
| API | RESTful endpoints |

## Getting Started

### Prerequisites

- Python 3.13
- Node.js and npm

### Backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment, then install dependencies:

```bash
pip install -r requirements.txt
```

Create a `backend/.env` file:

```env
DATABASE_URL=sqlite:///./forma.db
SECRET_KEY=replace-with-a-long-random-secret
```

Start the API:

```bash
uvicorn app.main:app --reload
```

API documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend

Open a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Architecture

Forma separates its React frontend from its FastAPI backend.

The frontend handles the user interface and communicates with the backend through HTTP requests. FastAPI handles authentication, application logic, and data access through SQLAlchemy.

## Project Background

I built Forma to gain practical experience developing a full-stack application beyond individual programming assignments. The project gave me experience connecting a frontend to a backend, designing relational data models, implementing authentication, and building workflows that support multiple users.

## Future Improvements

- Public demo deployment
- Automated testing and continuous integration
- Expanded team permissions
- Additional analytics and reporting
- Real-time collaboration features

## Author

**Amir Thompson**

[GitHub](https://github.com/amirt2505)