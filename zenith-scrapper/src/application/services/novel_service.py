"""Novel service - Application business logic."""

from typing import Optional

from src.domain.entities import Novel
from src.application.ports import ScraperPort, RepositoryPort
from src.utils.logger import get_logger
from src.utils.rate_limiter import RateLimiter

logger = get_logger()


class NovelService:
    """Service for novel operations - coordinates between scraper and repository."""

    def __init__(
        self,
        scraper: ScraperPort,
        repository: RepositoryPort,
        rate_limiter: Optional[RateLimiter] = None,
    ):
        """Initialize service with dependencies injected.

        Args:
            scraper: Scraper port for web scraping operations.
            repository: Repository port for persistence.
            rate_limiter: Rate limiter for pacing requests. Defaults to
                a RateLimiter with standard settings if not provided.
        """
        self.scraper = scraper
        self.repository = repository
        self.rate_limiter = rate_limiter or RateLimiter()

    async def scrape_and_save_novel(self, url: str, max_pages: Optional[int] = None) -> Novel:
        """Scrape novel from URL and save to repository."""
        logger.info(f"Scraping novel from: {url}")
        novel = await self.scraper.get_novel(url, max_pages)
        await self.repository.save_novel(novel)
        return novel

    async def get_novel(self, url: str) -> Optional[Novel]:
        """Get novel from repository."""
        return await self.repository.get_novel_by_url(url)

    async def scrape_chapter_content(self, url: str) -> str:
        """Scrape chapter content and save to repository."""
        logger.info(f"Scraping chapter: {url}")
        content = await self.scraper.get_chapter_content(url)
        await self.repository.save_chapter_content(url, content)
        return content

    async def scrape_all_chapters(self, novel_url: str) -> None:
        """Scrape content for all chapters of a novel."""
        logger.info(f"Starting batch chapter scraping for: {novel_url}")

        # Get novel from DB (or scrape if not exists)
        novel = await self.repository.get_novel_by_url(novel_url)
        if not novel:
            logger.info("Novel not in database, scraping first...")
            novel = await self.scrape_and_save_novel(novel_url)

        print(f"Found {novel.chapter_count} chapters for novel: {novel.title}")

        # Track failed chapters for reporting
        failed_chapters = []

        # Scrape each chapter with rate limiting and transaction handling
        chapters_scraped = 0
        try:
            for i, chapter in enumerate(novel.chapters, 1):
                if not chapter.has_content:
                    print(f"Scraping chapter {i}/{novel.chapter_count}: {chapter.title}")
                    try:
                        await self.scrape_chapter_content(chapter.url)
                        chapters_scraped += 1

                        # Commit after each successful chapter to avoid losing progress
                        await self.repository.commit()

                        # Delegate rate limiting to injected RateLimiter
                        delay = await self.rate_limiter.wait(chapters_scraped)
                        logger.debug(f"Rate limiter waited {delay:.2f}s after chapter {chapters_scraped}")
                    except Exception as e:
                        logger.error(f"Failed to scrape chapter {chapter.title}: {e}")
                        failed_chapters.append((chapter.title, str(e)))
                        # Continue with next chapter, don't rollback entire batch
                else:
                    print(f"Skipping chapter {i}/{novel.chapter_count} (already has content)")

            # Final commit after all chapters
            await self.repository.commit()
            logger.info("Batch chapter scraping completed")

        except Exception as e:
            # Critical failure - rollback all changes
            logger.error(f"Critical error during batch scraping: {e}")
            await self.repository.rollback()
            raise

        # Report summary of failures
        if failed_chapters:
            print(f"\n⚠️  Warning: {len(failed_chapters)} chapter(s) failed to scrape:")
            for title, error in failed_chapters:
                print(f"  - {title}: {error}")
