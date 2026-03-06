from dataclasses import dataclass
from typing import Optional


@dataclass
class Chapter:
    """Chapter domain entity."""
    title: str
    url: str
    order: int
    content: Optional[str] = None

    def __post_init__(self) -> None:
        """Validate chapter fields after initialization."""
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("Chapter title must not be empty")
        if not self.url or not self.url.strip():
            raise ValueError("Chapter URL must not be empty")
        self.url = self.url.strip()
        if self.order < 0:
            raise ValueError(f"Chapter order must be >= 0, got {self.order}")

    @property
    def has_content(self) -> bool:
        """Return True if the chapter has non-empty content."""
        return bool(self.content)
