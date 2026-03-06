from dataclasses import dataclass
from typing import Optional


@dataclass
class Author:
    """Author domain entity."""
    name: str
    description: Optional[str] = None
