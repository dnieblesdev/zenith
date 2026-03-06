import sys
import os
import asyncio

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.adapters.scraping import ScrapingCoordinator, WebScraper, NovelFireParser, NovelBinParser


async def verify_pagination() -> None:
    web_scraper = await WebScraper.create()
    parsers = [NovelFireParser(), NovelBinParser()]
    scraper = ScrapingCoordinator(web_scraper, parsers)
    try:
        # Martial Peak has many chapters
        url = "https://novelfire.net/book/martial-peak"
        print(f"Testing pagination on: {url}")
        # Limit to 2 pages
        novel = await scraper.get_novel(url, max_pages=2)

        print(f"Title: {novel.title}")
        print(f"Chapters found: {len(novel.chapters)}")

        # Should have > 50 chapters (usually 50-100 per page)
        if len(novel.chapters) > 50:
            print("SUCCESS: Found many chapters, likely paginated.")
        else:
            print("FAILURE: Found few chapters.")

        # Check if we have chapters from page 2
        last_chapter = novel.chapters[-1]
        print(f"Last chapter order: {last_chapter.order}")
        print(f"Last chapter title: {last_chapter.title}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        await scraper.close()


if __name__ == "__main__":
    asyncio.run(verify_pagination())
