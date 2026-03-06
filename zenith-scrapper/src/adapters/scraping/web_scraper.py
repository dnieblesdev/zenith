"""Web scraper - Browser lifecycle management implementation."""

from typing import Optional

from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright

from src.application.ports import WebScraperPort
from src.utils.logger import get_logger

logger = get_logger()


class WebScraper(WebScraperPort):
    """Playwright-based browser lifecycle manager.

    Handles browser/context creation, page management, navigation, and
    cleanup. Includes stealth configuration to avoid bot detection
    (custom user agent, webdriver property override, etc.).

    Knows nothing about parsing — use ParserPort implementations for
    extracting data from pages.
    """

    def __init__(self) -> None:
        logger.debug("Initializing WebScraper")
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None

    @classmethod
    async def create(cls) -> "WebScraper":
        """Create and initialize a WebScraper with a Chromium browser and stealth context."""
        self = cls()
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            timezone_id="America/New_York",
        )

        await self.context.add_init_script(
            """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """
        )
        await self.context.add_init_script(
            """
            window.navigator.chrome = {
                runtime: {},
                // etc.
            };
        """
        )
        await self.context.add_init_script(
            """
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
        """
        )
        await self.context.add_init_script(
            """
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
        """
        )

        return self

    def _ensure_initialized(self) -> None:
        """Raise RuntimeError if the browser context is not initialized."""
        if not self.context:
            raise RuntimeError("WebScraper is not initialized. Use WebScraper.create().")

    async def new_page(self) -> Page:
        """Create and return a new browser page."""
        self._ensure_initialized()
        assert self.context is not None
        return await self.context.new_page()

    async def navigate(self, page: Page, url: str, timeout: int = 60000) -> None:
        """Navigate a page to the given URL."""
        logger.debug(f"Navigating to: {url}")
        await page.goto(url, timeout=timeout)

    async def close_page(self, page: Page) -> None:
        """Close a browser page."""
        await page.close()

    async def close(self) -> None:
        """Close all browser resources (context, browser, playwright)."""
        logger.debug("Closing WebScraper")
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
