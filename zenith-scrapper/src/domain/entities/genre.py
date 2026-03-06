from dataclasses import dataclass
from typing import Optional


@dataclass
class Genre:
    """Genre domain entity."""
    name: str
    description: Optional[str] = None
