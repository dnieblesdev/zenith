"""Database migration script: export data, drop tables, recreate with Prisma."""

import json
import os
import sys
from datetime import datetime

# Connect to MySQL directly
try:
    import pymysql
except ImportError:
    print("Installing pymysql...")
    os.system("pip install pymysql")
    import pymysql

from dotenv import load_dotenv
load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")


def export_data():
    """Export all data from current database to JSON."""
    connection = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )
    
    data = {
        "export_date": datetime.now().isoformat(),
        "authors": [],
        "genres": [],
        "novels": [],
        "chapters": [],
        "novel_genres": []
    }
    
    try:
        with connection.cursor() as cursor:
            # Export authors
            cursor.execute("SELECT * FROM authors")
            data["authors"] = cursor.fetchall()
            print(f"Exported {len(data['authors'])} authors")
            
            # Export genres
            cursor.execute("SELECT * FROM genres")
            data["genres"] = cursor.fetchall()
            print(f"Exported {len(data['genres'])} genres")
            
            # Export novels (without relationships)
            cursor.execute("SELECT * FROM novels")
            novels = cursor.fetchall()
            data["novels"] = novels
            print(f"Exported {len(novels)} novels")
            
            # Export chapters
            cursor.execute("SELECT * FROM chapters")
            data["chapters"] = cursor.fetchall()
            print(f"Exported {len(data['chapters'])} chapters")
            
            # Export novel_genres junction table (may not exist)
            try:
                cursor.execute("SELECT * FROM novel_genres")
                data["novel_genres"] = cursor.fetchall()
                print(f"Exported {len(data['novel_genres'])} novel_genres relations")
            except pymysql.err.ProgrammingError:
                print("Note: novel_genres table doesn't exist, skipping")
                data["novel_genres"] = []
            
    finally:
        connection.close()
    
    # Save to file
    filename = f"db_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    
    print(f"\n[OK] Data exported to: {filename}")
    return filename


def drop_tables():
    """Drop all tables in the database."""
    connection = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    
    try:
        with connection.cursor() as cursor:
            # Disable foreign key checks
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            
            # Get all tables
            cursor.execute("SHOW TABLES")
            tables = [row[0] for row in cursor.fetchall()]
            
            # Drop each table
            for table in tables:
                print(f"Dropping table: {table}")
                cursor.execute(f"DROP TABLE IF EXISTS {table}")
            
            # Re-enable foreign key checks
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            connection.commit()
            
        print(f"\n[DONE] Dropped {len(tables)} tables")
    finally:
        connection.close()


def main():
    # Check for --force flag
    force = "--force" in sys.argv
    
    print("=" * 60)
    print("DATABASE MIGRATION SCRIPT")
    print("=" * 60)
    print(f"\nDatabase: {DB_NAME}")
    print(f"Host: {DB_HOST}\n")
    
    # Step 1: Export data
    print("\n[1/3] Exporting current data...")
    backup_file = export_data()
    
    # Step 2: Drop tables
    if not force:
        confirm = input(f"\nWARNING: This will DELETE all tables. Backup saved to: {backup_file}\nType 'yes' to continue: ")
        if confirm.lower() != "yes":
            print("Cancelled.")
            return
    
    print("\n[2/3] Dropping tables...")
    drop_tables()
    
    # Step 3: Run Prisma
    print("\n[3/3] Running Prisma db push...")
    print("\n[DONE] Migration preparation complete!")
    print("\nNext steps:")
    print("  1. Run: prisma db push")
    print("  2. Run: prisma generate")
    print(f"  3. If needed, import data from: {backup_file}")


if __name__ == "__main__":
    main()
