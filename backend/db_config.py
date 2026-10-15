import os

import psycopg2


def get_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL must be set before connecting to PostgreSQL.")

    sslmode = os.getenv("DB_SSLMODE", "prefer")
    return psycopg2.connect(database_url, sslmode=sslmode)
