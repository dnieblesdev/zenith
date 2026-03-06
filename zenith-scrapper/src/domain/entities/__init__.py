"""Domain entities - Business objects with unique identity."""

from .author import Author
from .genre import Genre
from .chapter import Chapter
from .novel import Novel

__all__ = ["Author", "Genre", "Chapter", "Novel"]
