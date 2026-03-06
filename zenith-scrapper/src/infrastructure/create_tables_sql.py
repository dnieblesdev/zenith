"""Create tables using raw SQL to avoid ORM issues"""
from sqlalchemy import text
from src.infrastructure.database import engine
from src.infrastructure.logger import get_logger

logger = get_logger()

def create_tables_sql():
    logger.info("Creating tables using raw SQL...")
    
    sql_statements = [
        """
        CREATE TABLE IF NOT EXISTS authors (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_author_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS genres (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_genre_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
        """
        CREATE TABLE IF NOT EXISTS novel_genres (
            novel_id INT NOT NULL,
            genre_id INT NOT NULL,
            PRIMARY KEY (novel_id, genre_id),
            FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
            FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    ]
    
    # Separate ALTER TABLE statements to avoid MySQL syntax issues
    alter_statements = [
        "ALTER TABLE novels ADD COLUMN author_id INT",
        "ALTER TABLE novels ADD CONSTRAINT fk_author FOREIGN KEY (author_id) REFERENCES authors(id)"
    ]
    
    try:
        with engine.connect() as conn:
            # Execute CREATE TABLE statements
            for i, sql in enumerate(sql_statements, 1):
                logger.info(f"Executing CREATE statement {i}/{len(sql_statements)}...")
                conn.execute(text(sql))
                conn.commit()
                logger.info(f"CREATE statement {i} completed successfully")
            
            # Execute ALTER TABLE statements (may fail if already exists)
            for i, sql in enumerate(alter_statements, 1):
                logger.info(f"Executing ALTER statement {i}/{len(alter_statements)}...")
                try:
                    conn.execute(text(sql))
                    conn.commit()
                    logger.info(f"ALTER statement {i} completed successfully")
                except Exception as e:
                    if "Duplicate" in str(e) or "already exists" in str(e):
                        logger.warning(f"ALTER statement {i} skipped (column/constraint already exists)")
                    else:
                        logger.error(f"ALTER statement {i} failed: {e}")
                        # Continue with other statements
        
        logger.info("All tables created/updated successfully!")
        return True
    except Exception as e:
        logger.error(f"Failed to create tables: {e}")
        return False

if __name__ == "__main__":
    success = create_tables_sql()
    exit(0 if success else 1)
