from flask import Flask, request, jsonify
from flask_cors import CORS
from db_config import get_connection
from psycopg2.extras import RealDictCursor
from datetime import datetime

app = Flask(__name__)
CORS(app)


def parse_due_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str)
    except:
        return None


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

    for t in todos:
        if t.get("due_date"):
            t["dueDate"] = t["due_date"].strftime("%Y-%m-%dT%H:%M")
        else:
            t["dueDate"] = None

        t["reminder_enabled"] = bool(t.get("reminder_enabled", True))
        t.pop("due_date", None)

    return jsonify(todos)


@app.route("/api/todos", methods=["POST"])
def add_todo():
    data = request.get_json() or {}
    due_date = parse_due_date(data.get("dueDate"))

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO todos (text, completed, due_date, priority, reminder_enabled)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            data.get("text"),
            data.get("completed", False),
            due_date,
            data.get("priority", "Low"),
            data.get("reminder_enabled", True)
        ))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return jsonify({"message": "Todo added successfully!"}), 201


@app.route("/api/todos/<int:id>", methods=["PUT"])
def update_todo(id):
    data = request.get_json() or {}
    due_date = parse_due_date(data.get("dueDate"))

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE todos
            SET text=%s, completed=%s, due_date=%s, priority=%s, reminder_enabled=%s
            WHERE id=%s
        """, (
            data.get("text"),
            data.get("completed", False),
            due_date,
            data.get("priority", "Low"),
            data.get("reminder_enabled", True),
            id
        ))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return jsonify({"message": "Todo updated successfully!"})


@app.route("/api/todos/<int:id>/toggle-reminder", methods=["PUT"])
def toggle_reminder(id):
    data = request.get_json() or {}
    new_value = data.get("reminder_enabled", True)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "UPDATE todos SET reminder_enabled=%s WHERE id=%s",
            (new_value, id)
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return jsonify({"message": "Reminder updated!"})


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

