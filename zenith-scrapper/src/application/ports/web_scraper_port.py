"""Web scraper port - Abstract interface for browser lifecycle management."""

from abc import ABC, abstractmethod

from playwright.async_api import Page


class WebScraperPort(ABC):
    """Abstract interface for browser lifecycle management.

    Handles browser/context creation, page management, and navigation.
    Knows nothing about parsing or extracting data from pages — that
    responsibility belongs to ParserPort implementations.
    """

    @abstractmethod
    async def new_page(self) -> Page:
        """Create and return a new browser page."""
        raise NotImplementedError

    @abstractmethod
    async def navigate(self, page: Page, url: str, timeout: int = 60000) -> None:
        """Navigate a page to the given URL."""
        raise NotImplementedError

    @abstractmethod
    async def close_page(self, page: Page) -> None:
        """Close a browser page."""
        raise NotImplementedError

    @abstractmethod
    async def close(self) -> None:
        """Close all browser resources (context, browser, playwright)."""
        raise NotImplementedError
