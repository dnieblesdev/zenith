"""Rate limiter utility for controlled request pacing."""

import asyncio
import random
from typing import Tuple

from src.utils.logger import get_logger

logger = get_logger()


class RateLimiter:
    """Configurable rate limiter with normal and extended delay support.

    Provides async sleep-based pacing to avoid detection during scraping.
    Extended pauses are triggered at configurable intervals to further
    reduce the risk of rate limiting or IP bans.
    """

    def __init__(
        self,
        normal_delay_range: Tuple[float, float] = (2.0, 5.0),
        extended_delay_range: Tuple[float, float] = (20.0, 40.0),
        extended_interval: int = 200,
    ) -> None:
        """Initialize the rate limiter.

        Args:
            normal_delay_range: Min and max seconds for normal delays.
            extended_delay_range: Min and max seconds for extended pauses.
            extended_interval: Trigger extended pause every N iterations.
        """
        self.normal_delay_range = normal_delay_range
        self.extended_delay_range = extended_delay_range
        self.extended_interval = extended_interval

    async def wait_normal(self) -> float:
        """Wait for a random duration within the normal delay range.

        Returns:
            The actual delay in seconds.
        """
        delay = random.uniform(*self.normal_delay_range)
        logger.debug(f"Rate limiter: normal wait {delay:.2f}s")
        await asyncio.sleep(delay)
        return delay

    async def wait_extended(self) -> float:
        """Wait for a random duration within the extended delay range.

        Returns:
            The actual delay in seconds.
        """
        delay = random.uniform(*self.extended_delay_range)
        logger.debug(f"Rate limiter: extended wait {delay:.2f}s")
        await asyncio.sleep(delay)
        return delay

    async def wait(self, iteration: int) -> float:
        """Wait with appropriate delay based on iteration count.

        Uses extended delay when iteration is a multiple of extended_interval,
        otherwise uses normal delay.

        Args:
            iteration: The current iteration number (1-based).

        Returns:
            The actual delay in seconds.
        """
        if iteration > 0 and iteration % self.extended_interval == 0:
            return await self.wait_extended()
        return await self.wait_normal()
