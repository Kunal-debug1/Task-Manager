import mysql.connector

def get_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",          # change if needed
        password="Pass@1234",
        database="todo_db"
    )
