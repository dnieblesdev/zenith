"""E2E smoke test for the new architecture wiring.

Verifies that the DI container correctly assembles all new components
(ScrapingCoordinator, WebScraper, parsers) without launching a real browser.
This is a WIRING test, not a functional test.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.infrastructure.di_container import DIContainer, get_container
from src.adapters.scraping.scraping_coordinator import ScrapingCoordinator
from src.adapters.scraping.web_scraper import WebScraper
from src.adapters.scraping.novelfire_parser import NovelFireParser
from src.adapters.scraping.novelbin_parser import NovelBinParser
from src.application.ports import ScraperPort, ParserPort, WebScraperPort
from src.application.services import NovelService


# ============================================================
# DIContainer: scraper wiring
# ============================================================


class TestDIContainerScraperWiring:
    """Tests that DIContainer wires the scraper as a ScrapingCoordinator."""

    @pytest.mark.asyncio
    async def test_get_scraper_returns_scraping_coordinator(self) -> None:
        """get_scraper() returns a ScrapingCoordinator instance."""
        container = DIContainer()

        # Mock WebScraper.create() to avoid launching a real browser
        mock_web_scraper = MagicMock(spec=WebScraper)
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper):
            scraper = await container.get_scraper()

        assert isinstance(scraper, ScrapingCoordinator)

    @pytest.mark.asyncio
    async def test_scraper_implements_scraper_port(self) -> None:
        """The returned scraper implements ScraperPort."""
        container = DIContainer()

        mock_web_scraper = MagicMock(spec=WebScraper)
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper):
            scraper = await container.get_scraper()

        assert isinstance(scraper, ScraperPort)

    @pytest.mark.asyncio
    async def test_coordinator_has_web_scraper(self) -> None:
        """The ScrapingCoordinator receives a WebScraper instance."""
        container = DIContainer()

        mock_web_scraper = MagicMock(spec=WebScraper)
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper):
            scraper = await container.get_scraper()

        assert isinstance(scraper, ScrapingCoordinator)
        # Access the internal web_scraper
        assert scraper._web_scraper is mock_web_scraper

    @pytest.mark.asyncio
    async def test_coordinator_has_both_parsers(self) -> None:
        """The ScrapingCoordinator receives both NovelFire and NovelBin parsers."""
        container = DIContainer()

        mock_web_scraper = MagicMock(spec=WebScraper)
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper):
            scraper = await container.get_scraper()

        assert isinstance(scraper, ScrapingCoordinator)
        parsers = scraper._parsers
        assert len(parsers) == 2

        parser_types = [type(p) for p in parsers]
        assert NovelFireParser in parser_types
        assert NovelBinParser in parser_types

    @pytest.mark.asyncio
    async def test_parsers_implement_parser_port(self) -> None:
        """All parsers in the coordinator implement ParserPort."""
        container = DIContainer()

        mock_web_scraper = MagicMock(spec=WebScraper)
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper):
            scraper = await container.get_scraper()

        assert isinstance(scraper, ScrapingCoordinator)
        for parser in scraper._parsers:
            assert isinstance(parser, ParserPort)

    @pytest.mark.asyncio
    async def test_scraper_is_cached(self) -> None:
        """get_scraper() returns the same instance on subsequent calls."""
        container = DIContainer()

        mock_web_scraper = MagicMock(spec=WebScraper)
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper):
            scraper1 = await container.get_scraper()
            scraper2 = await container.get_scraper()

        assert scraper1 is scraper2


# ============================================================
# DIContainer: NovelService wiring
# ============================================================


class TestDIContainerNovelServiceWiring:
    """Tests that DIContainer wires NovelService with the correct dependencies."""

    @pytest.mark.asyncio
    async def test_get_novel_service_returns_novel_service(self) -> None:
        """get_novel_service() returns a NovelService instance."""
        container = DIContainer()

        mock_web_scraper = MagicMock(spec=WebScraper)
        mock_db = MagicMock()
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper), \
             patch("src.infrastructure.di_container.get_db", return_value=mock_db):
            service = await container.get_novel_service()

        assert isinstance(service, NovelService)

    @pytest.mark.asyncio
    async def test_novel_service_receives_coordinator_as_scraper(self) -> None:
        """NovelService receives a ScrapingCoordinator as its scraper dependency."""
        container = DIContainer()

        mock_web_scraper = MagicMock(spec=WebScraper)
        mock_db = MagicMock()
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper), \
             patch("src.infrastructure.di_container.get_db", return_value=mock_db):
            service = await container.get_novel_service()

        assert isinstance(service.scraper, ScrapingCoordinator)

    @pytest.mark.asyncio
    async def test_novel_service_receives_rate_limiter(self) -> None:
        """NovelService receives a RateLimiter instance."""
        container = DIContainer()

        mock_web_scraper = MagicMock(spec=WebScraper)
        mock_db = MagicMock()
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper), \
             patch("src.infrastructure.di_container.get_db", return_value=mock_db):
            service = await container.get_novel_service()

        assert service.rate_limiter is not None


# ============================================================
# DIContainer: cleanup
# ============================================================


class TestDIContainerCleanup:
    """Tests for DIContainer.cleanup()."""

    @pytest.mark.asyncio
    async def test_cleanup_closes_scraper(self) -> None:
        """cleanup() calls close() on the scraper."""
        container = DIContainer()

        mock_web_scraper = MagicMock(spec=WebScraper)
        mock_web_scraper.close = AsyncMock()
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper):
            await container.get_scraper()

        await container.cleanup()

        # The coordinator's close() delegates to web_scraper.close()
        mock_web_scraper.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_cleanup_clears_scraper_reference(self) -> None:
        """cleanup() sets _scraper to None."""
        container = DIContainer()

        mock_web_scraper = MagicMock(spec=WebScraper)
        mock_web_scraper.close = AsyncMock()
        with patch.object(WebScraper, "create", new_callable=AsyncMock, return_value=mock_web_scraper):
            await container.get_scraper()

        await container.cleanup()
        assert container.scraper is None

    @pytest.mark.asyncio
    async def test_cleanup_without_scraper_is_safe(self) -> None:
        """cleanup() does not raise if no scraper was created."""
        container = DIContainer()
        await container.cleanup()  # Should not raise


# ============================================================
# Global container factory
# ============================================================


class TestGetContainer:
    """Tests for the get_container() global factory."""

    def test_get_container_returns_di_container(self) -> None:
        """get_container() returns a DIContainer instance."""
        # Reset global state for isolation
        import src.infrastructure.di_container as mod
        mod._container = None

        container = get_container()
        assert isinstance(container, DIContainer)

        # Cleanup global state
        mod._container = None

    def test_get_container_returns_same_instance(self) -> None:
        """get_container() returns the same instance on repeated calls."""
        import src.infrastructure.di_container as mod
        mod._container = None

        c1 = get_container()
        c2 = get_container()
        assert c1 is c2

        mod._container = None
