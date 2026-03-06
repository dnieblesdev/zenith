from abc import ABC, abstractmethod
from typing import Optional

from src.domain.entities import Novel


class RepositoryPort(ABC):
    """Abstract interface for novel persistence."""
    
    @abstractmethod
    async def save_novel(self, novel: Novel) -> None:
        """Save or update a novel."""
        pass
    
    @abstractmethod
    async def get_novel_by_url(self, url: str) -> Optional[Novel]:
        """Retrieve a novel by its URL."""
        pass
    
    @abstractmethod
    async def save_chapter_content(self, chapter_url: str, content: str) -> None:
        """Update chapter content."""
        pass
    
    @abstractmethod
    async def commit(self) -> None:
        """Commit the current transaction."""
        pass
    
    @abstractmethod
    async def rollback(self) -> None:
        """Rollback the current transaction."""
        pass
