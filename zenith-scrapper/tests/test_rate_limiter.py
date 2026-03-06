"""Unit tests for the RateLimiter utility."""

import asyncio
from unittest.mock import patch, AsyncMock

import pytest

from src.utils.rate_limiter import RateLimiter


# ============================================================
# RateLimiter: wait_normal()
# ============================================================


class TestRateLimiterWaitNormal:
    """Tests for RateLimiter.wait_normal()."""

    @pytest.mark.asyncio
    async def test_wait_normal_returns_delay_in_range(self) -> None:
        """wait_normal() returns a delay within the configured normal range."""
        limiter = RateLimiter(normal_delay_range=(1.0, 3.0))
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock):
            delay = await limiter.wait_normal()
        assert 1.0 <= delay <= 3.0

    @pytest.mark.asyncio
    async def test_wait_normal_calls_asyncio_sleep(self) -> None:
        """wait_normal() calls asyncio.sleep with the generated delay."""
        limiter = RateLimiter(normal_delay_range=(2.0, 5.0))
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            delay = await limiter.wait_normal()
            mock_sleep.assert_awaited_once_with(delay)

    @pytest.mark.asyncio
    async def test_wait_normal_uses_custom_range(self) -> None:
        """wait_normal() respects custom delay range."""
        limiter = RateLimiter(normal_delay_range=(0.1, 0.2))
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock):
            delay = await limiter.wait_normal()
        assert 0.1 <= delay <= 0.2


# ============================================================
# RateLimiter: wait_extended()
# ============================================================


class TestRateLimiterWaitExtended:
    """Tests for RateLimiter.wait_extended()."""

    @pytest.mark.asyncio
    async def test_wait_extended_returns_delay_in_range(self) -> None:
        """wait_extended() returns a delay within the configured extended range."""
        limiter = RateLimiter(extended_delay_range=(10.0, 20.0))
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock):
            delay = await limiter.wait_extended()
        assert 10.0 <= delay <= 20.0

    @pytest.mark.asyncio
    async def test_wait_extended_calls_asyncio_sleep(self) -> None:
        """wait_extended() calls asyncio.sleep with the generated delay."""
        limiter = RateLimiter(extended_delay_range=(20.0, 40.0))
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            delay = await limiter.wait_extended()
            mock_sleep.assert_awaited_once_with(delay)

    @pytest.mark.asyncio
    async def test_wait_extended_uses_custom_range(self) -> None:
        """wait_extended() respects custom delay range."""
        limiter = RateLimiter(extended_delay_range=(0.5, 1.0))
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock):
            delay = await limiter.wait_extended()
        assert 0.5 <= delay <= 1.0


# ============================================================
# RateLimiter: wait(iteration)
# ============================================================


class TestRateLimiterWait:
    """Tests for RateLimiter.wait(iteration)."""

    @pytest.mark.asyncio
    async def test_wait_uses_normal_delay_for_non_interval(self) -> None:
        """wait() uses normal delay when iteration is not a multiple of extended_interval."""
        limiter = RateLimiter(
            normal_delay_range=(1.0, 2.0),
            extended_delay_range=(10.0, 20.0),
            extended_interval=200,
        )
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock):
            delay = await limiter.wait(1)
        assert 1.0 <= delay <= 2.0

    @pytest.mark.asyncio
    async def test_wait_uses_extended_delay_at_interval(self) -> None:
        """wait() uses extended delay when iteration is a multiple of extended_interval."""
        limiter = RateLimiter(
            normal_delay_range=(1.0, 2.0),
            extended_delay_range=(10.0, 20.0),
            extended_interval=200,
        )
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock):
            delay = await limiter.wait(200)
        assert 10.0 <= delay <= 20.0

    @pytest.mark.asyncio
    async def test_wait_uses_extended_at_multiples_of_interval(self) -> None:
        """wait() triggers extended delay at every multiple of extended_interval."""
        limiter = RateLimiter(
            normal_delay_range=(1.0, 2.0),
            extended_delay_range=(10.0, 20.0),
            extended_interval=100,
        )
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock):
            delay_100 = await limiter.wait(100)
            delay_200 = await limiter.wait(200)
            delay_300 = await limiter.wait(300)
        assert 10.0 <= delay_100 <= 20.0
        assert 10.0 <= delay_200 <= 20.0
        assert 10.0 <= delay_300 <= 20.0

    @pytest.mark.asyncio
    async def test_wait_normal_for_non_multiples(self) -> None:
        """wait() uses normal delay for iterations that are not multiples."""
        limiter = RateLimiter(
            normal_delay_range=(1.0, 2.0),
            extended_delay_range=(10.0, 20.0),
            extended_interval=100,
        )
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock):
            delay_1 = await limiter.wait(1)
            delay_99 = await limiter.wait(99)
            delay_101 = await limiter.wait(101)
        assert 1.0 <= delay_1 <= 2.0
        assert 1.0 <= delay_99 <= 2.0
        assert 1.0 <= delay_101 <= 2.0

    @pytest.mark.asyncio
    async def test_wait_iteration_zero_uses_normal(self) -> None:
        """wait(0) uses normal delay (0 is not > 0, so no extended trigger)."""
        limiter = RateLimiter(
            normal_delay_range=(1.0, 2.0),
            extended_delay_range=(10.0, 20.0),
            extended_interval=200,
        )
        with patch("src.utils.rate_limiter.asyncio.sleep", new_callable=AsyncMock):
            delay = await limiter.wait(0)
        assert 1.0 <= delay <= 2.0


# ============================================================
# RateLimiter: default configuration
# ============================================================


class TestRateLimiterDefaults:
    """Tests for RateLimiter default configuration."""

    def test_default_normal_delay_range(self) -> None:
        """Default normal delay range is (2.0, 5.0)."""
        limiter = RateLimiter()
        assert limiter.normal_delay_range == (2.0, 5.0)

    def test_default_extended_delay_range(self) -> None:
        """Default extended delay range is (20.0, 40.0)."""
        limiter = RateLimiter()
        assert limiter.extended_delay_range == (20.0, 40.0)

    def test_default_extended_interval(self) -> None:
        """Default extended interval is 200."""
        limiter = RateLimiter()
        assert limiter.extended_interval == 200
