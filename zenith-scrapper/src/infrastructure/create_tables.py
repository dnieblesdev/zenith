from src.infrastructure.database import engine, Base
from src.infrastructure.orm_models import AuthorModel, GenreModel, novel_genres
from src.infrastructure.logger import get_logger

logger = get_logger()

def create_tables():
    logger.info("Creating tables...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Tables created successfully.")
    except Exception as e:
        logger.error(f"Failed to create tables: {e}")

if __name__ == "__main__":
    create_tables()
