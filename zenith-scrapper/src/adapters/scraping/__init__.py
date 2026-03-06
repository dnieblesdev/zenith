"""Scraping adapters."""

from .scraping_coordinator import ScrapingCoordinator
from .web_scraper import WebScraper
from .novelfire_parser import NovelFireParser
from .novelbin_parser import NovelBinParser

__all__ = ["ScrapingCoordinator", "WebScraper", "NovelFireParser", "NovelBinParser"]
