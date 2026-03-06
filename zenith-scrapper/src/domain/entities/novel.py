from dataclasses import dataclass, field
from typing import List, Optional

from .author import Author
from .genre import Genre
from .chapter import Chapter


@dataclass
class Novel:
    """Novel aggregate root."""
    title: str
    url: str
    author: Optional[Author] = None
    description: Optional[str] = None
    status: Optional[str] = None
    genres: List[Genre] = field(default_factory=list)
    chapters: List[Chapter] = field(default_factory=list)

    def __post_init__(self) -> None:
        """Validate novel fields after initialization."""
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("Novel title must not be empty")
        if not self.url or not self.url.strip():
            raise ValueError("Novel URL must not be empty")
        self.url = self.url.strip()

    def add_chapter(self, chapter: Chapter) -> None:
        """Add a chapter to the novel, silently ignoring duplicates by URL.

        Auto-assigns order if the chapter's order is 0 (default/unset).
        """
        if self.has_chapter(chapter.url):
            return
        if chapter.order == 0:
            chapter.order = len(self.chapters) + 1
        self.chapters.append(chapter)

    def has_chapter(self, url: str) -> bool:
        """Return True if a chapter with the given URL exists."""
        return any(c.url == url for c in self.chapters)

    @property
    def chapter_count(self) -> int:
        """Return the total number of chapters."""
        return len(self.chapters)

    @property
    def pending_chapters(self) -> List[Chapter]:
        """Return chapters that have not been scraped (no content)."""
        return [c for c in self.chapters if not c.has_content]
