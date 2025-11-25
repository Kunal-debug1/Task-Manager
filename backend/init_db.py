from db_config import get_connection

conn = get_connection()
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  text VARCHAR(255),
  completed BOOLEAN DEFAULT FALSE,
  due_date TIMESTAMP,
  priority VARCHAR(20),
  reminder_enabled BOOLEAN DEFAULT TRUE
);
""")
conn.commit()
cursor.close()
conn.close()
