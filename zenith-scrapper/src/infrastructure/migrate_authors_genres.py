from sqlalchemy.orm import Session
from src.infrastructure.database import engine, SessionLocal, Base
from src.infrastructure.orm_models import NovelModel, AuthorModel, GenreModel, novel_genres
from src.infrastructure.logger import get_logger

logger = get_logger()

def migrate_data():
    logger.info("Starting migration of Authors and Genres...")
    
    # Create new tables if they don't exist
    Base.metadata.create_all(bind=engine)
    logger.info("Tables ensured.")

    db: Session = SessionLocal()
    try:
        novels = db.query(NovelModel).all()
        logger.info(f"Found {len(novels)} novels to migrate.")

        for novel in novels:
            # Migrate Author
            if novel.author_old and not novel.author_id:
                author_name = novel.author_old.strip()
                if author_name and author_name != "Unknown":
                    author = db.query(AuthorModel).filter(AuthorModel.name == author_name).first()
                    if not author:
                        logger.info(f"Creating author: {author_name}")
                        author = AuthorModel(name=author_name)
                        db.add(author)
                        db.flush()
                    
                    novel.author_id = author.id
                    logger.info(f"Linked novel '{novel.title}' to author '{author.name}'")

            # Migrate Genres
            if novel.genres_old:
                genre_names = [g.strip() for g in novel.genres_old.split(",") if g.strip()]
                for g_name in genre_names:
                    genre = db.query(GenreModel).filter(GenreModel.name == g_name).first()
                    if not genre:
                        logger.info(f"Creating genre: {g_name}")
                        genre = GenreModel(name=g_name)
                        db.add(genre)
                        db.flush()
                    
                    if genre not in novel.genres_rel:
                        novel.genres_rel.append(genre)
                        logger.info(f"Linked novel '{novel.title}' to genre '{genre.name}'")

        db.commit()
        logger.info("Migration completed successfully.")
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_data()
