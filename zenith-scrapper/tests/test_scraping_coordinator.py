"""Integration tests for ScrapingCoordinator.

Tests the coordinator with MOCK dependencies (mock WebScraperPort + mock ParserPort)
to verify correct routing, error handling, and resource cleanup.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from typing import Optional

from playwright.async_api import Page

from src.adapters.scraping.scraping_coordinator import ScrapingCoordinator
from src.domain.entities import Novel


# ============================================================
# Helpers: Mock implementations
# ============================================================


class MockWebScraper:
    """Mock WebScraperPort for testing — no real browser.

    Does not inherit from WebScraperPort (ABC) because assigning AsyncMock
    in __init__ happens after ABC's instantiation check.  ScrapingCoordinator
    uses duck-typing, so this is sufficient for integration tests.
    """

    def __init__(self) -> None:
        self._mock_page = MagicMock(spec=Page)
        self.new_page = AsyncMock(return_value=self._mock_page)
        self.navigate = AsyncMock()
        self.close_page = AsyncMock()
        self.close = AsyncMock()

    @property
    def mock_page(self) -> MagicMock:
        """The mock page returned by new_page()."""
        return self._mock_page


class MockParser:
    """Mock ParserPort for testing — returns canned responses.

    Does not inherit from ParserPort (ABC) for the same reason as
    MockWebScraper.  ScrapingCoordinator only calls can_handle(),
    parse_novel(), and parse_chapter() — all provided here.
    """

    def __init__(self, handles_domain: str, novel_title: str = "Mock Novel") -> None:
        self._handles_domain = handles_domain
        self._novel_title = novel_title
        self.parse_novel = AsyncMock(
            return_value=Novel(
                title=novel_title,
                url=f"https://{handles_domain}/test",
            )
        )
        self.parse_chapter = AsyncMock(return_value="Mock chapter content.")

    def can_handle(self, url: str) -> bool:
        return self._handles_domain in url


def _make_coordinator(
    web_scraper: Optional[MockWebScraper] = None,
    parsers: Optional[list] = None,
) -> tuple:
    """Create a ScrapingCoordinator with mock dependencies.

    Returns:
        Tuple of (coordinator, web_scraper, novelfire_parser, novelbin_parser).
    """
    ws = web_scraper or MockWebScraper()
    nf_parser = MockParser("novelfire.net", "NovelFire Novel")
    nb_parser = MockParser("novelbin.com", "NovelBin Novel")
    p = parsers if parsers is not None else [nf_parser, nb_parser]
    coordinator = ScrapingCoordinator(ws, p)
    return coordinator, ws, nf_parser, nb_parser


# ============================================================
# ScrapingCoordinator: get_novel() routing
# ============================================================


class TestScrapingCoordinatorGetNovel:
    """Tests for ScrapingCoordinator.get_novel() URL routing."""

    @pytest.mark.asyncio
    async def test_routes_novelfire_url_to_novelfire_parser(self) -> None:
        """get_novel routes a novelfire.net URL to the NovelFire parser."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        novel = await coordinator.get_novel("https://novelfire.net/book/test")

        nf_parser.parse_novel.assert_awaited_once()
        nb_parser.parse_novel.assert_not_awaited()
        assert novel.title == "NovelFire Novel"

    @pytest.mark.asyncio
    async def test_routes_novelbin_url_to_novelbin_parser(self) -> None:
        """get_novel routes a novelbin.com URL to the NovelBin parser."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        novel = await coordinator.get_novel("https://novelbin.com/b/test")

        nb_parser.parse_novel.assert_awaited_once()
        nf_parser.parse_novel.assert_not_awaited()
        assert novel.title == "NovelBin Novel"

    @pytest.mark.asyncio
    async def test_raises_value_error_for_unsupported_url(self) -> None:
        """get_novel raises ValueError for an unsupported URL."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        with pytest.raises(ValueError, match="Unsupported URL"):
            await coordinator.get_novel("https://unknown-site.com/book/test")

    @pytest.mark.asyncio
    async def test_creates_and_closes_page(self) -> None:
        """get_novel creates a page and closes it after parsing."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        await coordinator.get_novel("https://novelfire.net/book/test")

        ws.new_page.assert_awaited_once()
        ws.close_page.assert_awaited_once_with(ws.mock_page)

    @pytest.mark.asyncio
    async def test_navigates_to_url(self) -> None:
        """get_novel navigates the page to the given URL."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        await coordinator.get_novel("https://novelfire.net/book/test")

        ws.navigate.assert_awaited_once_with(ws.mock_page, "https://novelfire.net/book/test")

    @pytest.mark.asyncio
    async def test_passes_max_pages_to_parser(self) -> None:
        """get_novel forwards max_pages to the parser."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        await coordinator.get_novel("https://novelfire.net/book/test", max_pages=5)

        call_args = nf_parser.parse_novel.call_args
        assert call_args[0][2] == 5  # third positional arg is max_pages

    @pytest.mark.asyncio
    async def test_page_cleanup_on_parser_error(self) -> None:
        """get_novel closes the page even if the parser raises an exception."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        nf_parser.parse_novel = AsyncMock(side_effect=RuntimeError("Parse failed"))

        with pytest.raises(RuntimeError, match="Parse failed"):
            await coordinator.get_novel("https://novelfire.net/book/test")

        # Page must still be closed (finally block)
        ws.close_page.assert_awaited_once_with(ws.mock_page)

    @pytest.mark.asyncio
    async def test_page_cleanup_on_navigate_error(self) -> None:
        """get_novel closes the page even if navigation raises an exception."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        ws.navigate = AsyncMock(side_effect=TimeoutError("Navigation timeout"))

        with pytest.raises(TimeoutError, match="Navigation timeout"):
            await coordinator.get_novel("https://novelfire.net/book/test")

        ws.close_page.assert_awaited_once_with(ws.mock_page)


# ============================================================
# ScrapingCoordinator: get_chapter_content() routing
# ============================================================


class TestScrapingCoordinatorGetChapterContent:
    """Tests for ScrapingCoordinator.get_chapter_content()."""

    @pytest.mark.asyncio
    async def test_routes_novelfire_chapter_to_correct_parser(self) -> None:
        """get_chapter_content routes novelfire.net chapter URL correctly."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        content = await coordinator.get_chapter_content(
            "https://novelfire.net/chapter/test/ch-1"
        )

        nf_parser.parse_chapter.assert_awaited_once()
        nb_parser.parse_chapter.assert_not_awaited()
        assert content == "Mock chapter content."

    @pytest.mark.asyncio
    async def test_routes_novelbin_chapter_to_correct_parser(self) -> None:
        """get_chapter_content routes novelbin.com chapter URL correctly."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        content = await coordinator.get_chapter_content(
            "https://novelbin.com/chapter/test/ch-1"
        )

        nb_parser.parse_chapter.assert_awaited_once()
        nf_parser.parse_chapter.assert_not_awaited()
        assert content == "Mock chapter content."

    @pytest.mark.asyncio
    async def test_raises_value_error_for_unsupported_chapter_url(self) -> None:
        """get_chapter_content raises ValueError for unsupported URL."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        with pytest.raises(ValueError, match="Unsupported URL"):
            await coordinator.get_chapter_content("https://unknown.com/ch-1")

    @pytest.mark.asyncio
    async def test_creates_and_closes_page_for_chapter(self) -> None:
        """get_chapter_content creates and closes the page."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        await coordinator.get_chapter_content("https://novelfire.net/chapter/test/ch-1")

        ws.new_page.assert_awaited_once()
        ws.close_page.assert_awaited_once_with(ws.mock_page)

    @pytest.mark.asyncio
    async def test_page_cleanup_on_chapter_parser_error(self) -> None:
        """get_chapter_content closes the page even if parser raises."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        nf_parser.parse_chapter = AsyncMock(side_effect=RuntimeError("Chapter parse failed"))

        with pytest.raises(RuntimeError, match="Chapter parse failed"):
            await coordinator.get_chapter_content(
                "https://novelfire.net/chapter/test/ch-1"
            )

        ws.close_page.assert_awaited_once_with(ws.mock_page)


# ============================================================
# ScrapingCoordinator: close()
# ============================================================


class TestScrapingCoordinatorClose:
    """Tests for ScrapingCoordinator.close()."""

    @pytest.mark.asyncio
    async def test_close_delegates_to_web_scraper(self) -> None:
        """close() delegates to web_scraper.close()."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        await coordinator.close()

        ws.close.assert_awaited_once()


# ============================================================
# ScrapingCoordinator: _find_parser()
# ============================================================


class TestScrapingCoordinatorFindParser:
    """Tests for ScrapingCoordinator._find_parser() internal routing."""

    def test_find_parser_returns_first_matching_parser(self) -> None:
        """_find_parser returns the first parser whose can_handle returns True."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        parser = coordinator._find_parser("https://novelfire.net/book/test")
        assert parser is nf_parser

    def test_find_parser_raises_for_no_match(self) -> None:
        """_find_parser raises ValueError when no parser matches."""
        coordinator, ws, nf_parser, nb_parser = _make_coordinator()
        with pytest.raises(ValueError, match="Unsupported URL"):
            coordinator._find_parser("https://unsupported.org/test")

    def test_find_parser_with_empty_parser_list(self) -> None:
        """_find_parser raises ValueError when parser list is empty."""
        ws = MockWebScraper()
        coordinator = ScrapingCoordinator(ws, [])
        with pytest.raises(ValueError, match="Unsupported URL"):
            coordinator._find_parser("https://novelfire.net/book/test")
