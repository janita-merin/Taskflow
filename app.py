"""
TaskFlow - Personal Task Manager
=================================
Main Flask application file.
This file sets up the Flask server, SQLite database, and all API endpoints.

Author: TaskFlow Project
"""

import os
import sqlite3
from flask import Flask, request, jsonify, render_template, g

# ─────────────────────────────────────────────
#  App Configuration
# ─────────────────────────────────────────────

app = Flask(__name__)

# Path to our SQLite database file
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database", "taskflow.db")


# ─────────────────────────────────────────────
#  Database Helpers
# ─────────────────────────────────────────────

def get_db():
    """
    Opens a database connection if one does not exist for the current
    application context. Flask's g object stores data for one request.
    """
    if "db" not in g:
        g.db = sqlite3.connect(
            DATABASE,
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        g.db.row_factory = sqlite3.Row  # rows behave like dicts (row["column_name"])
    return g.db


@app.teardown_appcontext
def close_db(error):
    """Closes the database connection after every request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """
    Creates the database folder and the tasks table if they do not exist yet.
    This runs once when the app starts.
    """
    os.makedirs(os.path.dirname(DATABASE), exist_ok=True)

    db = sqlite3.connect(DATABASE)
    cursor = db.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT    NOT NULL,
            description TEXT    DEFAULT '',
            priority    TEXT    DEFAULT 'medium',
            due_date    TEXT    DEFAULT '',
            completed   INTEGER DEFAULT 0,
            created_at  TEXT    DEFAULT (datetime('now'))
        )
    """)

    db.commit()
    db.close()
    print("Database initialised at:", DATABASE)


def task_to_dict(row):
    """
    Converts a database row into a plain Python dictionary so it can
    be returned as JSON in our API responses.
    """
    return {
        "id":          row["id"],
        "title":       row["title"],
        "description": row["description"] or "",
        "priority":    row["priority"],
        "due_date":    row["due_date"] or "",
        "completed":   bool(row["completed"]),
        "created_at":  row["created_at"],
    }


# ─────────────────────────────────────────────
#  Frontend Route
# ─────────────────────────────────────────────

@app.route("/")
def index():
    """Serves the main HTML page (single-page application)."""
    return render_template("index.html")


# ─────────────────────────────────────────────
#  API Routes
# ─────────────────────────────────────────────

# GET all tasks
@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    """
    Returns all tasks from the database as a JSON array.
    Supports optional filtering via ?filter=pending|completed|high
    """
    db = get_db()
    filter_param = request.args.get("filter", "all").lower()

    if filter_param == "pending":
        rows = db.execute(
            "SELECT * FROM tasks WHERE completed = 0 ORDER BY created_at DESC"
        ).fetchall()
    elif filter_param == "completed":
        rows = db.execute(
            "SELECT * FROM tasks WHERE completed = 1 ORDER BY created_at DESC"
        ).fetchall()
    elif filter_param == "high":
        rows = db.execute(
            "SELECT * FROM tasks WHERE priority = 'high' ORDER BY created_at DESC"
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM tasks ORDER BY created_at DESC"
        ).fetchall()

    tasks = [task_to_dict(row) for row in rows]
    return jsonify({"tasks": tasks, "count": len(tasks)})


# GET a single task
@app.route("/api/tasks/<int:task_id>", methods=["GET"])
def get_task(task_id):
    """Returns a single task by its ID."""
    db = get_db()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    if row is None:
        return jsonify({"error": f"Task {task_id} not found"}), 404

    return jsonify(task_to_dict(row))


# POST - Create a new task
@app.route("/api/tasks", methods=["POST"])
def create_task():
    """
    Creates a new task.
    Expects JSON body: { title, description, priority, due_date }
    """
    data = request.get_json()

    if not data or not data.get("title", "").strip():
        return jsonify({"error": "Title is required"}), 400

    title       = data["title"].strip()
    description = data.get("description", "").strip()
    priority    = data.get("priority", "medium").lower()
    due_date    = data.get("due_date", "").strip()

    if priority not in ("low", "medium", "high"):
        priority = "medium"

    db = get_db()
    cursor = db.execute(
        "INSERT INTO tasks (title, description, priority, due_date) VALUES (?, ?, ?, ?)",
        (title, description, priority, due_date),
    )
    db.commit()

    new_task = db.execute(
        "SELECT * FROM tasks WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()

    return jsonify(task_to_dict(new_task)), 201


# PUT - Update an existing task
@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    """
    Updates an existing task fields.
    Expects JSON body with any of: { title, description, priority, due_date, completed }
    """
    db = get_db()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    if row is None:
        return jsonify({"error": f"Task {task_id} not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    title       = data.get("title",       row["title"]).strip()
    description = data.get("description", row["description"] or "").strip()
    priority    = data.get("priority",    row["priority"]).lower()
    due_date    = data.get("due_date",    row["due_date"] or "").strip()
    completed   = int(data.get("completed", row["completed"]))

    if not title:
        return jsonify({"error": "Title cannot be empty"}), 400

    if priority not in ("low", "medium", "high"):
        priority = "medium"

    db.execute(
        "UPDATE tasks SET title=?, description=?, priority=?, due_date=?, completed=? WHERE id=?",
        (title, description, priority, due_date, completed, task_id),
    )
    db.commit()

    updated_task = db.execute(
        "SELECT * FROM tasks WHERE id = ?", (task_id,)
    ).fetchone()

    return jsonify(task_to_dict(updated_task))


# DELETE - Remove a task
@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    """Permanently deletes a task by ID."""
    db = get_db()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    if row is None:
        return jsonify({"error": f"Task {task_id} not found"}), 404

    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()

    return jsonify({"message": f"Task {task_id} deleted successfully"})


# PATCH - Toggle completion status
@app.route("/api/tasks/<int:task_id>/toggle", methods=["PATCH"])
def toggle_task(task_id):
    """Flips a task completed status between 0 and 1."""
    db = get_db()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    if row is None:
        return jsonify({"error": f"Task {task_id} not found"}), 404

    new_status = 0 if row["completed"] else 1
    db.execute(
        "UPDATE tasks SET completed = ? WHERE id = ?", (new_status, task_id)
    )
    db.commit()

    updated_task = db.execute(
        "SELECT * FROM tasks WHERE id = ?", (task_id,)
    ).fetchone()

    return jsonify(task_to_dict(updated_task))


# GET - Dashboard stats
@app.route("/api/stats", methods=["GET"])
def get_stats():
    """
    Returns summary counts for the dashboard:
    total tasks, completed tasks, and pending tasks.
    """
    db = get_db()
    total     = db.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    completed = db.execute("SELECT COUNT(*) FROM tasks WHERE completed = 1").fetchone()[0]
    pending   = total - completed
    high_prio = db.execute(
        "SELECT COUNT(*) FROM tasks WHERE priority = 'high' AND completed = 0"
    ).fetchone()[0]

    return jsonify({
        "total":                 total,
        "completed":             completed,
        "pending":               pending,
        "high_priority_pending": high_prio,
    })


# ─────────────────────────────────────────────
#  Entry Point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
