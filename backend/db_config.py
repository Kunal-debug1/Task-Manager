import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL not set in environment variables")

    conn = psycopg2.connect(
        DATABASE_URL,
        sslmode="require"   # Required by Render PostgreSQL
    )
    return conn
