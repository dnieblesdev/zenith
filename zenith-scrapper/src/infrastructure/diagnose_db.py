from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"

try:
    engine = create_engine(DATABASE_URL, connect_args={'connect_timeout': 5})
    with engine.connect() as conn:
        print("Connection successful!")
        result = conn.execute(text("SELECT * FROM authors LIMIT 1"))
        print(f"Authors query result: {result.fetchone()}")
except Exception as e:
    print(f"Query failed: {e}")
