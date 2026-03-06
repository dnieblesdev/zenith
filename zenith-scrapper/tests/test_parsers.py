"""Unit tests for NovelFireParser and NovelBinParser."""

import pytest
from unittest.mock import AsyncMock, MagicMock, PropertyMock

from src.adapters.scraping.novelfire_parser import NovelFireParser
from src.adapters.scraping.novelbin_parser import NovelBinParser


# ============================================================
# Helpers: Mock Playwright Page builders
# ============================================================


def _make_locator_mock(
    inner_text: str = "",
    get_attribute_map: dict = None,
    count: int = 0,
    is_visible: bool = True,
) -> MagicMock:
    """Create a mock Playwright Locator with common async methods."""
    loc = MagicMock()
    loc.inner_text = AsyncMock(return_value=inner_text)
    loc.get_attribute = AsyncMock(side_effect=lambda attr: (get_attribute_map or {}).get(attr))
    loc.count = AsyncMock(return_value=count)
    loc.is_visible = AsyncMock(return_value=is_visible)
    loc.click = AsyncMock()
    # .first returns the same locator mock (chain pattern)
    loc.first = loc
    return loc


def _make_novelfire_page(
    title: str = "Test Novel",
    author: str = "Test Author",
    description: str = "A test novel description.",
    status: str = "Ongoing",
    genres: list = None,
    chapters: list = None,
) -> MagicMock:
    """Build a mock Page pre-configured for NovelFireParser.parse_novel().

    Args:
        title: The novel title.
        author: The author name.
        description: The novel description.
        status: Novel publication status.
        genres: List of genre name strings. Defaults to ["Fantasy", "Action"].
        chapters: List of dicts with "title" and "url". Defaults to 2 sample chapters.
    """
    if genres is None:
        genres = ["Fantasy", "Action"]
    if chapters is None:
        chapters = [
            {"title": "Chapter 1", "url": "/book/test-novel/chapter-1"},
            {"title": "Chapter 2", "url": "/book/test-novel/chapter-2"},
        ]

    page = MagicMock()

    # --- Title locator: page.locator(".novel-title").first.inner_text() ---
    title_loc = _make_locator_mock(inner_text=title)
    # --- Author locator: page.locator(".author a") ---
    author_loc = _make_locator_mock(inner_text=author, count=1)
    # --- Description locator: page.locator(".summary .content").first.inner_text() ---
    desc_loc = _make_locator_mock(inner_text=description)

    # --- Status locator chain ---
    status_strong = _make_locator_mock(inner_text=status, is_visible=True)
    status_span_loc = MagicMock()
    status_span_loc.locator = MagicMock(return_value=status_strong)
    header_stats = MagicMock()
    header_stats.is_visible = AsyncMock(return_value=True)
    header_stats.locator = MagicMock(return_value=status_span_loc)
    header_stats.first = header_stats

    # --- Genres locator chain ---
    genre_locators = []
    for g in genres:
        gl = _make_locator_mock(inner_text=g)
        genre_locators.append(gl)

    genre_link_loc = MagicMock()
    genre_link_loc.count = AsyncMock(return_value=len(genres))
    genre_link_loc.nth = MagicMock(side_effect=lambda i: genre_locators[i])

    genres_list = MagicMock()
    genres_list.is_visible = AsyncMock(return_value=True)
    genres_list.locator = MagicMock(return_value=genre_link_loc)

    genres_following_sibling = MagicMock()
    genres_following_sibling.is_visible = AsyncMock(return_value=True)
    genres_following_sibling.first = genres_list

    genres_header = MagicMock()
    genres_header.is_visible = AsyncMock(return_value=True)
    genres_header.locator = MagicMock(return_value=genres_following_sibling)
    genres_header.first = genres_header

    # --- Chapter list locator ---
    chapter_element_mocks = []
    for ch in chapters:
        ch_el = MagicMock()
        ch_el.get_attribute = AsyncMock(
            side_effect=lambda attr, _ch=ch: _ch.get("title") if attr == "title" else _ch.get("url")
        )
        ch_el.inner_text = AsyncMock(return_value=ch["title"])
        strong_tag = _make_locator_mock(inner_text=ch["title"], is_visible=True)
        ch_el.locator = MagicMock(return_value=strong_tag)
        chapter_element_mocks.append(ch_el)

    chapter_elements_loc = MagicMock()
    chapter_elements_loc.count = AsyncMock(return_value=len(chapters))
    chapter_elements_loc.nth = MagicMock(side_effect=lambda i: chapter_element_mocks[i])

    # --- Next button (no next page) ---
    next_button = _make_locator_mock(is_visible=False)

    # --- Wire up page.locator() dispatch ---
    def _locator_dispatch(selector, **kwargs):
        if selector == ".novel-title":
            return title_loc
        elif selector == ".author a":
            return author_loc
        elif selector == "a.property-item[href*='/author/']":
            return _make_locator_mock(count=0)
        elif selector == ".summary .content":
            return desc_loc
        elif selector == ".header-stats":
            return header_stats
        elif selector == "span" and kwargs.get("has_text") == "Status":
            return status_span_loc
        elif selector == "h4" and kwargs.get("has_text") == "Genres":
            return genres_header
        elif selector == "ul.chapter-list a":
            return chapter_elements_loc
        elif selector == "a[aria-label='Next »']":
            return next_button
        else:
            return _make_locator_mock()

    page.locator = MagicMock(side_effect=_locator_dispatch)
    page.goto = AsyncMock()
    page.wait_for_selector = AsyncMock()
    page.wait_for_load_state = AsyncMock()

    return page


def _make_novelfire_chapter_page(paragraphs: list = None) -> MagicMock:
    """Build a mock Page for NovelFireParser.parse_chapter().

    Args:
        paragraphs: List of paragraph strings. If None, defaults to 2 sample paragraphs.
    """
    if paragraphs is None:
        paragraphs = ["First paragraph.", "Second paragraph."]

    page = MagicMock()

    p_mocks = []
    for text in paragraphs:
        p_mock = MagicMock()
        p_mock.inner_text = AsyncMock(return_value=text)
        p_mocks.append(p_mock)

    paragraphs_loc = MagicMock()
    paragraphs_loc.count = AsyncMock(return_value=len(paragraphs))
    paragraphs_loc.nth = MagicMock(side_effect=lambda i: p_mocks[i])

    content_div = MagicMock()
    content_div.locator = MagicMock(return_value=paragraphs_loc)
    content_div.inner_text = AsyncMock(return_value="\n".join(paragraphs))

    page.locator = MagicMock(return_value=content_div)

    return page


def _make_novelbin_page(
    title: str = "Bin Novel",
    author: str = "Bin Author",
    description: str = "A novelbin description.",
    chapters: list = None,
) -> MagicMock:
    """Build a mock Page for NovelBinParser.parse_novel().

    Args:
        title: Novel title.
        author: Author name.
        description: Novel description.
        chapters: List of dicts with "title" and "url". Defaults to 2 sample chapters.
    """
    if chapters is None:
        chapters = [
            {"title": "Ch 1", "url": "/novel/bin-novel/ch-1"},
            {"title": "Ch 2", "url": "/novel/bin-novel/ch-2"},
        ]

    page = MagicMock()

    title_loc = _make_locator_mock(inner_text=title)
    author_loc = _make_locator_mock(inner_text=author)
    desc_loc = _make_locator_mock(inner_text=description)

    chapter_mocks = []
    for ch in chapters:
        ch_el = MagicMock()
        ch_el.get_attribute = AsyncMock(
            side_effect=lambda attr, _ch=ch: _ch.get("title") if attr == "title" else _ch.get("url")
        )
        ch_el.inner_text = AsyncMock(return_value=ch["title"])
        chapter_mocks.append(ch_el)

    chapter_loc = MagicMock()
    chapter_loc.count = AsyncMock(return_value=len(chapters))
    chapter_loc.nth = MagicMock(side_effect=lambda i: chapter_mocks[i])

    def _locator_dispatch(selector, **kwargs):
        if selector == ".novel-title":
            return title_loc
        elif selector == ".author":
            return author_loc
        elif selector == ".summary":
            return desc_loc
        elif selector == ".list-chapter li a":
            return chapter_loc
        else:
            return _make_locator_mock()

    page.locator = MagicMock(side_effect=_locator_dispatch)

    return page


def _make_novelbin_chapter_page(content: str = "Chapter content text.") -> MagicMock:
    """Build a mock Page for NovelBinParser.parse_chapter()."""
    page = MagicMock()
    content_loc = _make_locator_mock(inner_text=content)
    page.locator = MagicMock(return_value=content_loc)
    return page


# ============================================================
# NovelFireParser: can_handle()
# ============================================================


class TestNovelFireParserCanHandle:
    """Tests for NovelFireParser.can_handle()."""

    def test_returns_true_for_novelfire_url(self) -> None:
        """can_handle returns True for a novelfire.net URL."""
        parser = NovelFireParser()
        assert parser.can_handle("https://novelfire.net/book/some-novel") is True

    def test_returns_true_for_novelfire_chapter_url(self) -> None:
        """can_handle returns True for a novelfire.net chapter URL."""
        parser = NovelFireParser()
        assert parser.can_handle("https://novelfire.net/chapter/some-novel/ch-1") is True

    def test_returns_false_for_novelbin_url(self) -> None:
        """can_handle returns False for a novelbin.com URL."""
        parser = NovelFireParser()
        assert parser.can_handle("https://novelbin.com/b/some-novel") is False

    def test_returns_false_for_unrelated_url(self) -> None:
        """can_handle returns False for an unrelated URL."""
        parser = NovelFireParser()
        assert parser.can_handle("https://google.com") is False

    def test_returns_false_for_empty_url(self) -> None:
        """can_handle returns False for an empty string."""
        parser = NovelFireParser()
        assert parser.can_handle("") is False


# ============================================================
# NovelFireParser: parse_novel()
# ============================================================


class TestNovelFireParserParseNovel:
    """Tests for NovelFireParser.parse_novel()."""

    @pytest.mark.asyncio
    async def test_parse_novel_extracts_title(self) -> None:
        """parse_novel extracts the novel title from the page."""
        parser = NovelFireParser()
        page = _make_novelfire_page(title="My Great Novel")
        novel = await parser.parse_novel(page, "https://novelfire.net/book/my-great-novel")
        assert novel.title == "My Great Novel"

    @pytest.mark.asyncio
    async def test_parse_novel_extracts_author(self) -> None:
        """parse_novel extracts the author name."""
        parser = NovelFireParser()
        page = _make_novelfire_page(author="Jane Doe")
        novel = await parser.parse_novel(page, "https://novelfire.net/book/test")
        assert novel.author is not None
        assert novel.author.name == "Jane Doe"

    @pytest.mark.asyncio
    async def test_parse_novel_extracts_description(self) -> None:
        """parse_novel extracts the description."""
        parser = NovelFireParser()
        page = _make_novelfire_page(description="An epic tale.")
        novel = await parser.parse_novel(page, "https://novelfire.net/book/test")
        assert novel.description == "An epic tale."

    @pytest.mark.asyncio
    async def test_parse_novel_extracts_status(self) -> None:
        """parse_novel extracts the novel status."""
        parser = NovelFireParser()
        page = _make_novelfire_page(status="Completed")
        novel = await parser.parse_novel(page, "https://novelfire.net/book/test")
        assert novel.status == "Completed"

    @pytest.mark.asyncio
    async def test_parse_novel_extracts_genres(self) -> None:
        """parse_novel extracts genre names."""
        parser = NovelFireParser()
        page = _make_novelfire_page(genres=["Fantasy", "Romance", "Adventure"])
        novel = await parser.parse_novel(page, "https://novelfire.net/book/test")
        genre_names = [g.name for g in novel.genres]
        assert genre_names == ["Fantasy", "Romance", "Adventure"]

    @pytest.mark.asyncio
    async def test_parse_novel_extracts_chapters(self) -> None:
        """parse_novel extracts chapter titles and URLs."""
        parser = NovelFireParser()
        chapters = [
            {"title": "Chapter 1: Begin", "url": "/book/test/ch-1"},
            {"title": "Chapter 2: Continue", "url": "/book/test/ch-2"},
        ]
        page = _make_novelfire_page(chapters=chapters)
        novel = await parser.parse_novel(page, "https://novelfire.net/book/test")
        assert len(novel.chapters) == 2
        assert novel.chapters[0].title == "Chapter 1: Begin"
        # Relative URLs are prefixed with novelfire.net
        assert novel.chapters[0].url.startswith("https://novelfire.net")

    @pytest.mark.asyncio
    async def test_parse_novel_preserves_url(self) -> None:
        """parse_novel sets the novel URL to the original URL."""
        parser = NovelFireParser()
        page = _make_novelfire_page()
        url = "https://novelfire.net/book/test"
        novel = await parser.parse_novel(page, url)
        assert novel.url == url

    @pytest.mark.asyncio
    async def test_parse_novel_navigates_to_chapters_page(self) -> None:
        """parse_novel navigates to the /chapters sub-page."""
        parser = NovelFireParser()
        page = _make_novelfire_page()
        await parser.parse_novel(page, "https://novelfire.net/book/test")
        page.goto.assert_awaited_once_with(
            "https://novelfire.net/book/test/chapters", timeout=60000
        )

    @pytest.mark.asyncio
    async def test_parse_novel_with_zero_chapters(self) -> None:
        """parse_novel handles pages with no chapters."""
        parser = NovelFireParser()
        page = _make_novelfire_page(chapters=[])
        novel = await parser.parse_novel(page, "https://novelfire.net/book/test")
        assert len(novel.chapters) == 0

    @pytest.mark.asyncio
    async def test_parse_novel_with_max_pages(self) -> None:
        """parse_novel respects the max_pages parameter."""
        parser = NovelFireParser()
        page = _make_novelfire_page()
        novel = await parser.parse_novel(page, "https://novelfire.net/book/test", max_pages=1)
        # With max_pages=1, it processes only one page of chapters
        assert novel is not None


# ============================================================
# NovelFireParser: parse_chapter()
# ============================================================


class TestNovelFireParserParseChapter:
    """Tests for NovelFireParser.parse_chapter()."""

    @pytest.mark.asyncio
    async def test_parse_chapter_extracts_paragraphs(self) -> None:
        """parse_chapter joins paragraph texts with double newlines."""
        parser = NovelFireParser()
        page = _make_novelfire_chapter_page(["Para one.", "Para two.", "Para three."])
        content = await parser.parse_chapter(page)
        assert content == "Para one.\n\nPara two.\n\nPara three."

    @pytest.mark.asyncio
    async def test_parse_chapter_falls_back_to_inner_text(self) -> None:
        """parse_chapter falls back to content div inner_text when no <p> tags."""
        parser = NovelFireParser()
        page = _make_novelfire_chapter_page(paragraphs=[])
        # When paragraph_count is 0, it falls back to content_div.inner_text()
        content = await parser.parse_chapter(page)
        assert isinstance(content, str)

    @pytest.mark.asyncio
    async def test_parse_chapter_single_paragraph(self) -> None:
        """parse_chapter works with a single paragraph."""
        parser = NovelFireParser()
        page = _make_novelfire_chapter_page(["Only one paragraph."])
        content = await parser.parse_chapter(page)
        assert content == "Only one paragraph."


# ============================================================
# NovelBinParser: can_handle()
# ============================================================


class TestNovelBinParserCanHandle:
    """Tests for NovelBinParser.can_handle()."""

    def test_returns_true_for_novelbin_url(self) -> None:
        """can_handle returns True for a novelbin.com URL."""
        parser = NovelBinParser()
        assert parser.can_handle("https://novelbin.com/b/some-novel") is True

    def test_returns_true_for_novelbin_chapter_url(self) -> None:
        """can_handle returns True for a novelbin.com chapter URL."""
        parser = NovelBinParser()
        assert parser.can_handle("https://novelbin.com/chapter/test/ch-1") is True

    def test_returns_false_for_novelfire_url(self) -> None:
        """can_handle returns False for a novelfire.net URL."""
        parser = NovelBinParser()
        assert parser.can_handle("https://novelfire.net/book/test") is False

    def test_returns_false_for_unrelated_url(self) -> None:
        """can_handle returns False for an unrelated URL."""
        parser = NovelBinParser()
        assert parser.can_handle("https://example.com") is False

    def test_returns_false_for_empty_url(self) -> None:
        """can_handle returns False for an empty string."""
        parser = NovelBinParser()
        assert parser.can_handle("") is False


# ============================================================
# NovelBinParser: parse_novel()
# ============================================================


class TestNovelBinParserParseNovel:
    """Tests for NovelBinParser.parse_novel()."""

    @pytest.mark.asyncio
    async def test_parse_novel_extracts_title(self) -> None:
        """parse_novel extracts the novel title."""
        parser = NovelBinParser()
        page = _make_novelbin_page(title="Bin Novel Title")
        novel = await parser.parse_novel(page, "https://novelbin.com/b/test")
        assert novel.title == "Bin Novel Title"

    @pytest.mark.asyncio
    async def test_parse_novel_extracts_author(self) -> None:
        """parse_novel extracts the author name."""
        parser = NovelBinParser()
        page = _make_novelbin_page(author="Bin Author")
        novel = await parser.parse_novel(page, "https://novelbin.com/b/test")
        assert novel.author is not None
        assert novel.author.name == "Bin Author"

    @pytest.mark.asyncio
    async def test_parse_novel_extracts_description(self) -> None:
        """parse_novel extracts the description."""
        parser = NovelBinParser()
        page = _make_novelbin_page(description="A binned story.")
        novel = await parser.parse_novel(page, "https://novelbin.com/b/test")
        assert novel.description == "A binned story."

    @pytest.mark.asyncio
    async def test_parse_novel_extracts_chapters(self) -> None:
        """parse_novel extracts chapters with correct URLs."""
        parser = NovelBinParser()
        chapters = [
            {"title": "Ch 1", "url": "/novel/test/ch-1"},
            {"title": "Ch 2", "url": "/novel/test/ch-2"},
            {"title": "Ch 3", "url": "/novel/test/ch-3"},
        ]
        page = _make_novelbin_page(chapters=chapters)
        novel = await parser.parse_novel(page, "https://novelbin.com/b/test")
        assert len(novel.chapters) == 3
        assert novel.chapters[0].url.startswith("https://novelbin.com")
        assert novel.chapters[2].order == 3

    @pytest.mark.asyncio
    async def test_parse_novel_preserves_url(self) -> None:
        """parse_novel sets the novel URL to the original URL."""
        parser = NovelBinParser()
        page = _make_novelbin_page()
        url = "https://novelbin.com/b/test"
        novel = await parser.parse_novel(page, url)
        assert novel.url == url

    @pytest.mark.asyncio
    async def test_parse_novel_with_zero_chapters(self) -> None:
        """parse_novel handles pages with no chapters."""
        parser = NovelBinParser()
        page = _make_novelbin_page(chapters=[])
        novel = await parser.parse_novel(page, "https://novelbin.com/b/test")
        assert len(novel.chapters) == 0

    @pytest.mark.asyncio
    async def test_parse_novel_sets_status_unknown(self) -> None:
        """parse_novel defaults status to 'Unknown' (novelbin has no status element)."""
        parser = NovelBinParser()
        page = _make_novelbin_page()
        novel = await parser.parse_novel(page, "https://novelbin.com/b/test")
        assert novel.status == "Unknown"

    @pytest.mark.asyncio
    async def test_parse_novel_sets_empty_genres(self) -> None:
        """parse_novel returns empty genres list (novelbin has no genre elements)."""
        parser = NovelBinParser()
        page = _make_novelbin_page()
        novel = await parser.parse_novel(page, "https://novelbin.com/b/test")
        assert novel.genres == []


# ============================================================
# NovelBinParser: parse_chapter()
# ============================================================


class TestNovelBinParserParseChapter:
    """Tests for NovelBinParser.parse_chapter()."""

    @pytest.mark.asyncio
    async def test_parse_chapter_extracts_content(self) -> None:
        """parse_chapter extracts chapter text from #chapter-content."""
        parser = NovelBinParser()
        page = _make_novelbin_chapter_page("The hero entered the dungeon.")
        content = await parser.parse_chapter(page)
        assert content == "The hero entered the dungeon."

    @pytest.mark.asyncio
    async def test_parse_chapter_returns_string(self) -> None:
        """parse_chapter returns a string type."""
        parser = NovelBinParser()
        page = _make_novelbin_chapter_page("Some text.")
        content = await parser.parse_chapter(page)
        assert isinstance(content, str)
