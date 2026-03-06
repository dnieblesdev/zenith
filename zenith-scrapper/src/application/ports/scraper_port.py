from abc import ABC, abstractmethod
from typing import Optional

from src.domain.entities import Novel


class ScraperPort(ABC):
    """Abstract interface for web scraping."""

    @abstractmethod
    async def get_novel(self, url: str, max_pages: Optional[int] = None) -> Novel:
        """Scrape novel details and chapters from URL."""
        raise NotImplementedError

    @abstractmethod
    async def get_chapter_content(self, url: str) -> str:
        """Scrape chapter content from URL."""
        raise NotImplementedError

    @abstractmethod
    async def close(self) -> None:
        """Close scraper resources."""
        raise NotImplementedError
