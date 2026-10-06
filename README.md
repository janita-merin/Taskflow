# TaskFlow – Personal Task Manager

A beginner-friendly, full-stack personal task manager built with **Flask**, **SQLite**, and **Vanilla JavaScript**.  
Designed as a clean portfolio project that demonstrates REST API design, database management, and modern UI principles.

---

## Preview

> Start the app and visit `http://127.0.0.1:5000` in your browser.

---

## Features

- **Dashboard** – real-time counts of total, pending, completed, and high-priority tasks  
- **Add Tasks** – title, description, priority (Low / Medium / High), due date  
- **Edit Tasks** – update any field inline, form switches to edit mode  
- **Delete Tasks** – confirmation modal prevents accidental deletion  
- **Toggle Completion** – one-click checkbox to mark tasks done / pending  
- **Filter Tasks** – All | Pending | Completed | High Priority  
- **Overdue Highlighting** – past-due tasks are flagged automatically  
- **Responsive Design** – works on desktop and mobile  
- **Toast Notifications** – non-intrusive feedback for every action  

---

## Technologies Used

| Layer      | Technology          |
|------------|---------------------|
| Frontend   | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Backend    | Python 3, Flask     |
| Database   | SQLite (via Python's built-in `sqlite3` module) |
| Fonts      | Google Fonts – Inter |

---

## Project Structure

```
TaskFlow/
│
├── app.py               # Flask server + all API routes
├── requirements.txt     # Python dependencies
├── README.md            # This file
├── .gitignore           # Files excluded from Git
│
├── templates/
│   └── index.html       # Single-page HTML (served by Flask)
│
├── static/
│   ├── css/
│   │   └── style.css    # All visual styling
│   └── js/
│       └── script.js    # All frontend logic / API calls
│
└── database/
    └── taskflow.db      # Auto-created SQLite database (git-ignored)
```

---

## Installation

### Prerequisites

- Python 3.8 or newer  
- pip (comes with Python)

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/taskflow.git
   cd taskflow
   ```

2. **Create a virtual environment** *(recommended)*

   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

---

## How to Run

```bash
python app.py
```

Open your browser and visit:  
**http://127.0.0.1:5000**

The SQLite database (`database/taskflow.db`) is created automatically on first run.

> To stop the server press `Ctrl + C`.

---

## API Endpoints

Base URL: `http://127.0.0.1:5000`

| Method | Endpoint                        | Description                     |
|--------|---------------------------------|---------------------------------|
| GET    | `/api/tasks`                    | Get all tasks (supports `?filter=all\|pending\|completed\|high`) |
| GET    | `/api/tasks/<id>`               | Get a single task by ID         |
| POST   | `/api/tasks`                    | Create a new task               |
| PUT    | `/api/tasks/<id>`               | Update an existing task         |
| DELETE | `/api/tasks/<id>`               | Delete a task                   |
| PATCH  | `/api/tasks/<id>/toggle`        | Toggle task completion status   |
| GET    | `/api/stats`                    | Get dashboard statistics        |

### Example Request – Create a Task

```bash
curl -X POST http://127.0.0.1:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title":       "Study Flask",
    "description": "Go through the official Flask tutorial",
    "priority":    "high",
    "due_date":    "2025-12-31"
  }'
```

### Example Response

```json
{
  "id": 1,
  "title": "Study Flask",
  "description": "Go through the official Flask tutorial",
  "priority": "high",
  "due_date": "2025-12-31",
  "completed": false,
  "created_at": "2025-10-07 10:00:00"
}
```

---

## Database Schema

```sql
CREATE TABLE tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    priority    TEXT    DEFAULT 'medium',   -- 'low' | 'medium' | 'high'
    due_date    TEXT    DEFAULT '',
    completed   INTEGER DEFAULT 0,          -- 0 = pending, 1 = completed
    created_at  TEXT    DEFAULT (datetime('now'))
);
```

---

## File Descriptions

| File | Purpose |
|------|---------|
| `app.py` | Flask application entry point; defines routes and database logic |
| `requirements.txt` | Lists Python packages needed (`flask`) |
| `.gitignore` | Prevents committing venv, database, cache files |
| `templates/index.html` | The full HTML structure of the single-page app |
| `static/css/style.css` | Dark-theme CSS with variables, animations, and responsive layout |
| `static/js/script.js` | Fetch-based API calls, rendering, form handling, filtering |

---

## License

MIT – feel free to use and modify for your own projects.
