"""NovelBin site-specific parser implementation."""

from typing import List, Optional

from playwright.async_api import Page

from src.application.ports import ParserPort
from src.domain.entities import Author, Chapter, Novel
from src.utils.logger import get_logger

logger = get_logger()


class NovelBinParser(ParserPort):
    """Parser for novelbin.com novel pages.

    Extracts novel metadata, chapter lists, and chapter content from
    novelbin.com using Playwright page locators.
    """

    def can_handle(self, url: str) -> bool:
        """Return True if the URL belongs to novelbin.com."""
        return "novelbin.com" in url

    async def parse_novel(
        self, page: Page, url: str, max_pages: Optional[int] = None
    ) -> Novel:
        """Parse novel metadata and chapter list from a novelbin.com page.

        The max_pages parameter is accepted for interface compatibility but
        is not used — novelbin.com does not paginate chapter lists.
        """
        logger.debug("Scraping NovelBin novel page")
        title = (await page.locator(".novel-title").first.inner_text()).strip()
        author = (await page.locator(".author").first.inner_text()).strip()
        description = (await page.locator(".summary").first.inner_text()).strip()

        chapters: List[Chapter] = []
        chapter_elements = page.locator(".list-chapter li a")
        chapter_count = await chapter_elements.count()

        for i in range(chapter_count):
            el = chapter_elements.nth(i)
            chapter_title = await el.get_attribute("title")
            if not chapter_title:
                chapter_title = await el.inner_text()

            chapter_url = await el.get_attribute("href")
            if chapter_url:
                if not chapter_url.startswith("http"):
                    chapter_url = "https://novelbin.com" + chapter_url
                chapters.append(Chapter(title=chapter_title.strip(), url=chapter_url, order=i + 1))

        author_obj = Author(name=author) if author else None
        return Novel(
            title=title,
            url=url,
            author=author_obj,
            description=description,
            status="Unknown",
            genres=[],
            chapters=chapters,
        )

    async def parse_chapter(self, page: Page) -> str:
        """Parse chapter content from a novelbin.com chapter page.

        Extracts text from the #chapter-content element.
        """
        return await page.locator("#chapter-content").inner_text()
