"""Scraping coordinator - Orchestrates browser management and site-specific parsing.

Implements ScraperPort as a drop-in replacement for PlaywrightScraper by
composing WebScraperPort (browser lifecycle) with ParserPort implementations
(site-specific extraction).
"""

from typing import List, Optional

from src.application.ports import ParserPort, ScraperPort, WebScraperPort
from src.domain.entities import Novel
from src.utils.logger import get_logger

logger = get_logger()


class ScrapingCoordinator(ScraperPort):
    """Coordinates browser management and site-specific parsing.

    Receives a WebScraperPort for page/browser lifecycle and a list of
    ParserPort implementations for site-specific extraction. Routes
    requests to the correct parser based on URL matching.

    This is a drop-in replacement for PlaywrightScraper — it implements
    the exact same ScraperPort interface.
    """

    def __init__(
        self,
        web_scraper: WebScraperPort,
        parsers: List[ParserPort],
    ) -> None:
        logger.debug("Initializing ScrapingCoordinator")
        self._web_scraper = web_scraper
        self._parsers = parsers

    def _find_parser(self, url: str) -> ParserPort:
        """Find a parser that can handle the given URL.

        Raises:
            ValueError: If no parser supports the URL.
        """
        for parser in self._parsers:
            if parser.can_handle(url):
                return parser
        raise ValueError(f"Unsupported URL: {url}")

    async def get_novel(self, url: str, max_pages: Optional[int] = None) -> Novel:
        """Scrape novel details and chapters from URL.

        Creates a browser page, navigates to the URL, finds the appropriate
        parser, and delegates extraction. Ensures page cleanup in all cases.
        """
        logger.info(f"Getting novel details from: {url}")
        parser = self._find_parser(url)
        page = await self._web_scraper.new_page()
        try:
            await self._web_scraper.navigate(page, url)
            return await parser.parse_novel(page, url, max_pages)
        finally:
            await self._web_scraper.close_page(page)

    async def get_chapter_content(self, url: str) -> str:
        """Scrape chapter content from URL.

        Creates a browser page, navigates to the URL, finds the appropriate
        parser, and delegates content extraction. Ensures page cleanup in all cases.
        """
        logger.info(f"Getting chapter content from: {url}")
        parser = self._find_parser(url)
        page = await self._web_scraper.new_page()
        try:
            await self._web_scraper.navigate(page, url)
            return await parser.parse_chapter(page)
        finally:
            await self._web_scraper.close_page(page)

    async def close(self) -> None:
        """Close all browser resources by delegating to the web scraper."""
        logger.debug("Closing ScrapingCoordinator")
        await self._web_scraper.close()
