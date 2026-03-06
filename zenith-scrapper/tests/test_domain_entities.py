"""Unit tests for Novel and Chapter domain entities."""

import pytest
from typing import List, Optional

from src.domain.entities.chapter import Chapter
from src.domain.entities.novel import Novel


# ============================================================
# Helpers
# ============================================================


def _make_chapter(
    title: str = "Ch 1",
    url: str = "https://example.com/ch1",
    order: int = 1,
    content: Optional[str] = None,
) -> Chapter:
    """Helper to create a Chapter with sensible defaults."""
    return Chapter(title=title, url=url, order=order, content=content)


def _make_novel(chapters: Optional[List[Chapter]] = None) -> Novel:
    """Helper to create a Novel with sensible defaults."""
    novel = Novel(title="Test Novel", url="https://example.com/novel")
    if chapters:
        novel.chapters = chapters
    return novel


# ============================================================
# Chapter: __post_init__ validation
# ============================================================


class TestChapterPostInit:
    """Tests for Chapter.__post_init__ validation."""

    def test_valid_chapter_creation(self) -> None:
        """A chapter with valid title, url, and order is created normally."""
        ch = Chapter(title="Chapter 1", url="https://example.com/ch1", order=1)
        assert ch.title == "Chapter 1"
        assert ch.url == "https://example.com/ch1"
        assert ch.order == 1

    def test_title_is_stripped(self) -> None:
        """Leading/trailing whitespace is stripped from title."""
        ch = Chapter(title="  Chapter 1  ", url="https://example.com/ch1", order=1)
        assert ch.title == "Chapter 1"

    def test_url_is_stripped(self) -> None:
        """Leading/trailing whitespace is stripped from url."""
        ch = Chapter(title="Chapter 1", url="  https://example.com/ch1  ", order=1)
        assert ch.url == "https://example.com/ch1"

    def test_empty_title_raises_value_error(self) -> None:
        """An empty title (after stripping) raises ValueError."""
        with pytest.raises(ValueError, match="title must not be empty"):
            Chapter(title="", url="https://example.com/ch1", order=1)

    def test_whitespace_only_title_raises_value_error(self) -> None:
        """A whitespace-only title raises ValueError."""
        with pytest.raises(ValueError, match="title must not be empty"):
            Chapter(title="   ", url="https://example.com/ch1", order=1)

    def test_empty_url_raises_value_error(self) -> None:
        """An empty url raises ValueError."""
        with pytest.raises(ValueError, match="URL must not be empty"):
            Chapter(title="Chapter 1", url="", order=1)

    def test_whitespace_only_url_raises_value_error(self) -> None:
        """A whitespace-only url raises ValueError."""
        with pytest.raises(ValueError, match="URL must not be empty"):
            Chapter(title="Chapter 1", url="   ", order=1)

    def test_negative_order_raises_value_error(self) -> None:
        """A negative order raises ValueError."""
        with pytest.raises(ValueError, match="order must be >= 0"):
            Chapter(title="Chapter 1", url="https://example.com/ch1", order=-1)

    def test_zero_order_is_allowed(self) -> None:
        """Order of 0 is valid (used as 'unset' sentinel)."""
        ch = Chapter(title="Chapter 1", url="https://example.com/ch1", order=0)
        assert ch.order == 0


# ============================================================
# Chapter: has_content property
# ============================================================


class TestChapterHasContent:
    """Tests for Chapter.has_content property."""

    def test_has_content_when_none(self) -> None:
        """has_content returns False when content is None (default)."""
        ch = Chapter(title="Ch 1", url="https://example.com/ch1", order=1)
        assert ch.has_content is False

    def test_has_content_when_empty_string(self) -> None:
        """has_content returns False when content is an empty string."""
        ch = Chapter(title="Ch 1", url="https://example.com/ch1", order=1, content="")
        assert ch.has_content is False

    def test_has_content_when_valid(self) -> None:
        """has_content returns True when content is a non-empty string."""
        ch = Chapter(
            title="Ch 1",
            url="https://example.com/ch1",
            order=1,
            content="Some chapter text...",
        )
        assert ch.has_content is True


# ============================================================
# Novel: __post_init__ validation
# ============================================================


class TestNovelPostInit:
    """Tests for Novel.__post_init__ validation."""

    def test_valid_novel_creation(self) -> None:
        """A novel with valid title and url is created normally."""
        novel = Novel(title="Test Novel", url="https://example.com/novel")
        assert novel.title == "Test Novel"
        assert novel.url == "https://example.com/novel"

    def test_title_is_stripped(self) -> None:
        """Leading/trailing whitespace is stripped from title."""
        novel = Novel(title="  Test Novel  ", url="https://example.com/novel")
        assert novel.title == "Test Novel"

    def test_url_is_stripped(self) -> None:
        """Leading/trailing whitespace is stripped from url."""
        novel = Novel(title="Test Novel", url="  https://example.com/novel  ")
        assert novel.url == "https://example.com/novel"

    def test_empty_title_raises_value_error(self) -> None:
        """An empty title raises ValueError."""
        with pytest.raises(ValueError, match="title must not be empty"):
            Novel(title="", url="https://example.com/novel")

    def test_whitespace_only_title_raises_value_error(self) -> None:
        """A whitespace-only title raises ValueError."""
        with pytest.raises(ValueError, match="title must not be empty"):
            Novel(title="   ", url="https://example.com/novel")

    def test_empty_url_raises_value_error(self) -> None:
        """An empty url raises ValueError."""
        with pytest.raises(ValueError, match="URL must not be empty"):
            Novel(title="Test Novel", url="")

    def test_whitespace_only_url_raises_value_error(self) -> None:
        """A whitespace-only url raises ValueError."""
        with pytest.raises(ValueError, match="URL must not be empty"):
            Novel(title="Test Novel", url="   ")


# ============================================================
# Novel: add_chapter()
# ============================================================


class TestNovelAddChapter:
    """Tests for Novel.add_chapter()."""

    def test_add_chapter_to_empty_novel(self) -> None:
        """Adding a chapter to a novel with 0 chapters works."""
        novel = _make_novel()
        ch = _make_chapter()
        novel.add_chapter(ch)

        assert novel.chapter_count == 1
        assert novel.chapters[0].url == "https://example.com/ch1"

    def test_duplicate_chapter_silently_ignored(self) -> None:
        """Adding a chapter with a duplicate URL is silently ignored."""
        novel = _make_novel()
        ch1 = _make_chapter(title="Ch 1", url="https://example.com/ch1", order=1)
        ch2 = _make_chapter(title="Ch 1 Dup", url="https://example.com/ch1", order=2)
        novel.add_chapter(ch1)
        novel.add_chapter(ch2)

        assert novel.chapter_count == 1
        # The first added chapter is kept
        assert novel.chapters[0].title == "Ch 1"

    def test_auto_assign_order_when_zero(self) -> None:
        """When order is 0, auto-assign based on current collection size."""
        novel = _make_novel()
        ch1 = _make_chapter(title="Ch 1", url="https://example.com/ch1", order=1)
        ch2 = _make_chapter(title="Ch 2", url="https://example.com/ch2", order=2)
        ch3 = _make_chapter(title="Ch 3", url="https://example.com/ch3", order=3)
        novel.add_chapter(ch1)
        novel.add_chapter(ch2)
        novel.add_chapter(ch3)

        ch_auto = _make_chapter(title="Ch 4", url="https://example.com/ch4", order=0)
        novel.add_chapter(ch_auto)

        assert novel.chapter_count == 4
        assert ch_auto.order == 4

    def test_add_multiple_distinct_chapters(self) -> None:
        """Adding multiple chapters with different URLs works."""
        novel = _make_novel()
        for i in range(1, 6):
            novel.add_chapter(
                _make_chapter(
                    title=f"Ch {i}",
                    url=f"https://example.com/ch{i}",
                    order=i,
                )
            )
        assert novel.chapter_count == 5


# ============================================================
# Novel: has_chapter()
# ============================================================


class TestNovelHasChapter:
    """Tests for Novel.has_chapter()."""

    def test_has_chapter_returns_true_for_existing(self) -> None:
        """has_chapter returns True for a URL that exists."""
        novel = _make_novel()
        novel.add_chapter(_make_chapter(url="https://example.com/ch1"))
        assert novel.has_chapter("https://example.com/ch1") is True

    def test_has_chapter_returns_false_for_missing(self) -> None:
        """has_chapter returns False for a URL that does not exist."""
        novel = _make_novel()
        assert novel.has_chapter("https://example.com/nonexistent") is False

    def test_has_chapter_empty_novel(self) -> None:
        """has_chapter returns False on an empty novel."""
        novel = _make_novel()
        assert novel.has_chapter("https://example.com/ch1") is False


# ============================================================
# Novel: chapter_count property
# ============================================================


class TestNovelChapterCount:
    """Tests for Novel.chapter_count property."""

    def test_chapter_count_empty(self) -> None:
        """chapter_count is 0 for a novel with no chapters."""
        novel = _make_novel()
        assert novel.chapter_count == 0

    def test_chapter_count_with_chapters(self) -> None:
        """chapter_count reflects the number of chapters."""
        novel = _make_novel()
        for i in range(1, 4):
            novel.add_chapter(
                _make_chapter(
                    title=f"Ch {i}",
                    url=f"https://example.com/ch{i}",
                    order=i,
                )
            )
        assert novel.chapter_count == 3


# ============================================================
# Novel: pending_chapters property
# ============================================================


class TestNovelPendingChapters:
    """Tests for Novel.pending_chapters property."""

    def test_all_chapters_pending_when_no_content(self) -> None:
        """All chapters without content are pending."""
        novel = _make_novel()
        for i in range(1, 4):
            novel.add_chapter(
                _make_chapter(
                    title=f"Ch {i}",
                    url=f"https://example.com/ch{i}",
                    order=i,
                )
            )
        assert len(novel.pending_chapters) == 3

    def test_no_pending_when_all_have_content(self) -> None:
        """No chapters are pending when all have content."""
        novel = _make_novel()
        for i in range(1, 4):
            novel.add_chapter(
                _make_chapter(
                    title=f"Ch {i}",
                    url=f"https://example.com/ch{i}",
                    order=i,
                    content=f"Content for chapter {i}",
                )
            )
        assert len(novel.pending_chapters) == 0

    def test_mixed_pending_and_scraped(self) -> None:
        """Only chapters without content appear in pending_chapters."""
        novel = _make_novel()
        novel.add_chapter(
            _make_chapter(
                title="Ch 1", url="https://example.com/ch1", order=1, content="Done"
            )
        )
        novel.add_chapter(
            _make_chapter(title="Ch 2", url="https://example.com/ch2", order=2)
        )
        novel.add_chapter(
            _make_chapter(
                title="Ch 3", url="https://example.com/ch3", order=3, content="Done"
            )
        )

        pending = novel.pending_chapters
        assert len(pending) == 1
        assert pending[0].title == "Ch 2"

    def test_empty_string_content_is_pending(self) -> None:
        """A chapter with empty string content is considered pending."""
        novel = _make_novel()
        novel.add_chapter(
            _make_chapter(
                title="Ch 1", url="https://example.com/ch1", order=1, content=""
            )
        )
        assert len(novel.pending_chapters) == 1
