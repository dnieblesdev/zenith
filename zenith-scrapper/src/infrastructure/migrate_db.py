from sqlalchemy import text
from src.infrastructure.database import engine, get_logger

logger = get_logger()

def migrate():
    with engine.connect() as conn:
        logger.info("Attempting to add 'status' column...")
        try:
            conn.execute(text("ALTER TABLE novels ADD COLUMN status VARCHAR(50)"))
            logger.info("'status' column added.")
        except Exception as e:
            logger.warning(f"Could not add 'status' column (might already exist): {e}")

        logger.info("Attempting to add 'genres' column...")
        try:
            conn.execute(text("ALTER TABLE novels ADD COLUMN genres TEXT"))
            logger.info("'genres' column added.")
        except Exception as e:
            logger.warning(f"Could not add 'genres' column (might already exist): {e}")
        
        conn.commit()

if __name__ == "__main__":
    migrate()
