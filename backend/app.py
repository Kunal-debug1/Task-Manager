# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from db_config import get_connection
from psycopg2.extras import RealDictCursor
from datetime import datetime

app = Flask(__name__)
CORS(app)


# ---------------------------------------
# Utility: safely parse datetime-local
# ---------------------------------------
def parse_due_date(date_str):
    if not date_str:
        return None
    try:
        # Accepts "YYYY-MM-DDTHH:MM" or ISO strings
        return datetime.fromisoformat(date_str)
    except Exception:
        return None


# ---------------------------------------
# GET all todos
# ---------------------------------------
@app.route("/api/todos", methods=["GET"])
def get_todos():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT * FROM todos ORDER BY id;")
        todos = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

    # Convert DB fields → frontend-friendly fields
    for t in todos:
        if t.get("due_date"):
            # Keep format consistent with React datetime-local input
            t["dueDate"] = t["due_date"].strftime("%Y-%m-%dT%H:%M")
        else:
            t["dueDate"] = None

        # Ensure frontend receives a boolean and remove raw DB field
        t["reminder_enabled"] = bool(t.get("reminder_enabled", True))
        t.pop("due_date", None)

    return jsonify(todos)


# ---------------------------------------
# POST Create new todo
# ---------------------------------------
@app.route("/api/todos", methods=["POST"])
def add_todo():
    data = request.get_json() or {}
    due_date = parse_due_date(data.get("dueDate"))
    reminder_enabled = data.get("reminder_enabled", True)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO todos (text, completed, due_date, priority, reminder_enabled)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                data.get("text"),
                data.get("completed", False),
                due_date,
                data.get("priority", "Low"),
                reminder_enabled,
            ),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return jsonify({"message": "Todo added successfully!"}), 201


# ---------------------------------------
# PUT Update todo
# ---------------------------------------
@app.route("/api/todos/<int:id>", methods=["PUT"])
def update_todo(id):
    data = request.get_json() or {}
    due_date = parse_due_date(data.get("dueDate"))

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE todos
            SET text=%s, completed=%s, due_date=%s, priority=%s, reminder_enabled=%s
            WHERE id=%s
            """,
            (
                data.get("text"),
                data.get("completed", False),
                due_date,
                data.get("priority", "Low"),
                data.get("reminder_enabled", True),
                id,
            ),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return jsonify({"message": "Todo updated successfully!"})


# ---------------------------------------
# PUT Toggle Reminder Only
# ---------------------------------------
@app.route("/api/todos/<int:id>/toggle-reminder", methods=["PUT"])
def toggle_reminder(id):
    data = request.get_json() or {}
    new_value = data.get("reminder_enabled", True)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE todos SET reminder_enabled=%s WHERE id=%s",
            (new_value, id),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return jsonify({"message": "Reminder updated!"})


# ---------------------------------------
# DELETE todo
# ---------------------------------------
@app.route("/api/todos/<int:id>", methods=["DELETE"])
def delete_todo(id):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM todos WHERE id=%s", (id,))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return jsonify({"message": "Todo deleted!"})


