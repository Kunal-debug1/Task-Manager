import os
import psycopg2
from psycopg2.extras import RealDictCursor


def get_connection():
    database_url = os.getenv("DATABASE_URL")

    # -------------------------------
    # 1️⃣ LOCAL DEVELOPMENT (no DATABASE_URL)
    # -------------------------------
    if not database_url:
        return psycopg2.connect(
            host=os.getenv("DB_HOST", "dpg-d4ip0oshg0os73a3j4ng-a"),
            database=os.getenv("DB_NAME", "todo_db_eg4y"),
            user=os.getenv("DB_USER", "todo_db_eg4y_user"),
            password=os.getenv("DB_PASSWORD", "sTfCSN06XQ7KJ9qIWmFblLZj52rvAHmC"),  # change if needed
            port=os.getenv("DB_PORT", "5432")
        )

    # -------------------------------
    # 2️⃣ PRODUCTION / RENDER (uses DATABASE_URL)
    # -------------------------------
    return psycopg2.connect(
        database_url,
        sslmode="require"
    )
