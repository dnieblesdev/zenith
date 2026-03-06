"""Dependency Injection Container - Wires up the application dependencies."""

from typing import Optional

from src.prisma import Prisma

from src.application.ports import RepositoryPort, ScraperPort
from src.application.services import NovelService
from src.adapters.scraping import (
    ScrapingCoordinator,
    WebScraper,
    NovelFireParser,
    NovelBinParser,
)
from src.adapters.persistence.prisma_repository import PrismaNovelRepository
from src.infrastructure.database import Database, get_db
from src.utils.rate_limiter import RateLimiter


class DIContainer:
    """Simple DI container for dependency management."""

    def __init__(self) -> None:
        self._db: Optional[Prisma] = None
        self._scraper: Optional[ScraperPort] = None
        self._repository: Optional[RepositoryPort] = None
        self._rate_limiter: Optional[RateLimiter] = None

    @property
    def db(self) -> Prisma:
        if self._db is None:
            self._db = get_db()
        return self._db

    @property
    def scraper(self) -> Optional[ScraperPort]:
        return self._scraper

    async def get_scraper(self) -> ScraperPort:
        if self._scraper is None:
            web_scraper = await WebScraper.create()
            parsers = [NovelFireParser(), NovelBinParser()]
            self._scraper = ScrapingCoordinator(web_scraper, parsers)
        return self._scraper

    @property
    def repository(self) -> RepositoryPort:
        if self._repository is None:
            self._repository = PrismaNovelRepository(self.db)
        return self._repository

    @property
    def rate_limiter(self) -> RateLimiter:
        if self._rate_limiter is None:
            self._rate_limiter = RateLimiter()
        return self._rate_limiter

    async def get_novel_service(self) -> NovelService:
        scraper = await self.get_scraper()
        return NovelService(scraper, self.repository, self.rate_limiter)

    async def connect_db(self) -> None:
        """Connect to the database."""
        await Database.connect()

    async def disconnect_db(self) -> None:
        """Disconnect from the database."""
        await Database.disconnect()

    async def cleanup(self) -> None:
        """Clean up resources."""
        if self._scraper:
            await self._scraper.close()
            self._scraper = None


# Global instance
_container: Optional[DIContainer] = None


def get_container() -> DIContainer:
    """Get the global container instance."""
    global _container
    if _container is None:
        _container = DIContainer()
    return _container
