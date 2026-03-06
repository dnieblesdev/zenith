"""Parser port - Abstract interface for site-specific parsing."""

from abc import ABC, abstractmethod
from typing import Optional

from playwright.async_api import Page

from src.domain.entities import Novel


class ParserPort(ABC):
    """Abstract interface for site-specific HTML parsing.

    Parsers receive a Playwright Page object (already navigated to the target URL)
    and extract domain entities from it. They know nothing about browser lifecycle
    management — that responsibility belongs to WebScraperPort.
    """

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """Return True if this parser supports the given URL."""
        raise NotImplementedError

    @abstractmethod
    async def parse_novel(
        self, page: Page, url: str, max_pages: Optional[int] = None
    ) -> Novel:
        """Parse novel metadata and chapter list from the page.

        The page should already be navigated to the novel's URL.
        The parser may perform additional navigation (e.g., pagination).
        """
        raise NotImplementedError

    @abstractmethod
    async def parse_chapter(self, page: Page) -> str:
        """Parse chapter content from the page.

        The page should already be navigated to the chapter's URL.
        Returns the chapter text content as a string.
        """
        raise NotImplementedError
