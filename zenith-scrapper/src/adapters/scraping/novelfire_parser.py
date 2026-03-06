"""NovelFire site-specific parser implementation."""

from typing import List, Optional

from playwright.async_api import Page

from src.application.ports import ParserPort
from src.domain.entities import Author, Chapter, Genre, Novel
from src.utils.logger import get_logger

logger = get_logger()


class NovelFireParser(ParserPort):
    """Parser for novelfire.net novel pages.

    Extracts novel metadata, chapter lists (with pagination), and chapter
    content from novelfire.net using Playwright page locators.
    """

    def can_handle(self, url: str) -> bool:
        """Return True if the URL belongs to novelfire.net."""
        return "novelfire.net" in url

    async def parse_novel(
        self, page: Page, url: str, max_pages: Optional[int] = None
    ) -> Novel:
        """Parse novel metadata and chapter list from a novelfire.net page.

        Navigates to the chapters sub-page and paginates through all chapter
        list pages (or up to max_pages if specified).
        """
        logger.debug("Scraping NovelFire novel page")
        title = (await page.locator(".novel-title").first.inner_text()).strip()

        author = "Unknown"
        author_locator = page.locator(".author a")
        if await author_locator.count() > 0:
            author = (await author_locator.first.inner_text()).strip()
        else:
            alt_author_locator = page.locator("a.property-item[href*='/author/']")
            if await alt_author_locator.count() > 0:
                author = (await alt_author_locator.first.inner_text()).strip()

        description = (await page.locator(".summary .content").first.inner_text()).strip()

        status = "Unknown"
        genres: List[Genre] = []

        try:
            header_stats = page.locator(".header-stats").first
            if await header_stats.is_visible():
                status_element = header_stats.locator("span", has_text="Status").locator("strong").first
                if await status_element.is_visible():
                    status = (await status_element.inner_text()).strip()

                genres_header = page.locator("h4", has_text="Genres").first
                if await genres_header.is_visible():
                    genres_list = genres_header.locator("xpath=following-sibling::ul").first
                    if await genres_list.is_visible():
                        genre_locator = genres_list.locator("a")
                        genre_count = await genre_locator.count()
                        for i in range(genre_count):
                            genre_text = (await genre_locator.nth(i).inner_text()).strip()
                            genres.append(Genre(name=genre_text))
        except Exception as e:
            logger.warning(f"Failed to scrape status/genres: {e}")

        chapters_url = url + "/chapters" if not url.endswith("/chapters") else url
        logger.debug(f"Navigating to chapters page: {chapters_url}")

        await page.goto(chapters_url, timeout=60000)

        chapters: List[Chapter] = []
        page_count = 0

        while True:
            page_count += 1
            if max_pages and page_count > max_pages:
                logger.info(f"Reached max pages limit ({max_pages}). Stopping.")
                break

            try:
                await page.wait_for_selector("ul.chapter-list", timeout=10000)
            except Exception as e:
                logger.warning(f"Timeout waiting for chapter list: {e}")
                break

            chapter_elements = page.locator("ul.chapter-list a")
            chapter_count = await chapter_elements.count()
            logger.debug(f"Found {chapter_count} chapter elements on page {page_count}")

            for i in range(chapter_count):
                el = chapter_elements.nth(i)
                chapter_title = await el.get_attribute("title")
                if not chapter_title:
                    chapter_title = await el.inner_text()

                strong_tag = el.locator("strong").first
                if await strong_tag.is_visible():
                    chapter_title = (await strong_tag.inner_text()).strip()

                chapter_url = await el.get_attribute("href")
                if chapter_url:
                    if not chapter_url.startswith("http"):
                        chapter_url = "https://novelfire.net" + chapter_url
                    if not any(c.url == chapter_url for c in chapters):
                        chapters.append(
                            Chapter(title=chapter_title.strip(), url=chapter_url, order=len(chapters) + 1)
                        )

            next_button = page.locator("a[aria-label='Next »']")
            if await next_button.is_visible():
                logger.info("Navigating to next page of chapters...")
                await next_button.click()
                await page.wait_for_load_state("networkidle")
            else:
                logger.debug("No more pages found.")
                break

        author_obj = Author(name=author) if author != "Unknown" else None
        return Novel(
            title=title,
            url=url,
            author=author_obj,
            description=description,
            status=status,
            genres=genres,
            chapters=chapters,
        )

    async def parse_chapter(self, page: Page) -> str:
        """Parse chapter content from a novelfire.net chapter page.

        Extracts paragraph text from the #content div. Falls back to
        full inner_text if no <p> tags are found.
        """
        content_div = page.locator("#content")

        paragraphs_locator = content_div.locator("p")
        paragraph_count = await paragraphs_locator.count()
        if paragraph_count > 0:
            paragraphs = []
            for i in range(paragraph_count):
                paragraphs.append(await paragraphs_locator.nth(i).inner_text())
            return "\n\n".join(paragraphs)

        return await content_div.inner_text()
