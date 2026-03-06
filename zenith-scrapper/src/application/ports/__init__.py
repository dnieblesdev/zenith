"""Application ports - Abstract interfaces for external dependencies."""

from .scraper_port import ScraperPort
from .repository_port import RepositoryPort
from .parser_port import ParserPort
from .web_scraper_port import WebScraperPort

__all__ = ["ScraperPort", "RepositoryPort", "ParserPort", "WebScraperPort"]
