#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Entry point for Zenith Scraper - uses DI container for dependency management."""

import sys
import os
import asyncio
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.infrastructure.di_container import get_container


async def run(args: argparse.Namespace) -> None:
    """Run the scraper with the given CLI arguments."""
    container = get_container()
    await container.connect_db()

    try:
        service = await container.get_novel_service()

        if args.chapter:
            content = await service.scrape_chapter_content(args.url)
            print(f"Saved ({len(content)} chars)")

        elif args.scrape_chapters:
            await service.scrape_all_chapters(args.url)

        else:
            novel = await service.scrape_and_save_novel(args.url)
            print(f"Novel: {novel.title}")
            print(f"Chapters: {len(novel.chapters)}")

    finally:
        await container.cleanup()
        await container.disconnect_db()


def main() -> None:
    """Parse CLI arguments and run the scraper."""
    parser = argparse.ArgumentParser(description="Zenith Scraper")
    parser.add_argument("url", help="URL to scrape")
    parser.add_argument(
        "--chapter",
        action="store_true",
        help="Scrape a single chapter's content",
    )
    parser.add_argument(
        "--scrape-chapters",
        action="store_true",
        help="Scrape all chapters of a novel",
    )
    args = parser.parse_args()

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
