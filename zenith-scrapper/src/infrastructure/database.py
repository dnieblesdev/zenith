"""Database module using Prisma Client Python."""

import os
import asyncio
from typing import Optional
from src.prisma import Prisma
from dotenv import load_dotenv

load_dotenv()

# Validate required environment variables
REQUIRED_ENV_VARS = ["DATABASE_URL"]
missing_vars = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
if missing_vars:
    raise EnvironmentError(
        f"Error: Missing required environment variables: {', '.join(missing_vars)}\n"
        f"Please create a .env file with the following variable:\n"
        f"  DATABASE_URL=mysql://user:password@host:port/database"
    )


class Database:
    """Singleton database connection using Prisma."""
    
    _instance: Optional[Prisma] = None
    
    @classmethod
    def get_client(cls) -> Prisma:
        """Get or create Prisma client instance."""
        if cls._instance is None:
            cls._instance = Prisma()
        return cls._instance
    
    @classmethod
    async def connect(cls) -> None:
        """Connect to the database."""
        client = cls.get_client()
        if not client.is_connected():
            await client.connect()
    
    @classmethod
    async def disconnect(cls) -> None:
        """Disconnect from the database."""
        client = cls.get_client()
        if client.is_connected():
            await client.disconnect()


# Convenience function for getting the Prisma client
def get_db() -> Prisma:
    """Get the Prisma client instance."""
    return Database.get_client()
