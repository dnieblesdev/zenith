"""Prisma implementation of RepositoryPort."""

from typing import Optional, List
from src.prisma import Prisma

from src.domain.entities import Novel, Chapter, Author, Genre
from src.application.ports import RepositoryPort
from src.utils.logger import get_logger

logger = get_logger()


class PrismaNovelRepository(RepositoryPort):
    """Prisma implementation of RepositoryPort."""

    def __init__(self, db: Prisma):
        self.db = db

    def _to_domain_novel(self, db_novel) -> Novel:
        """Convert Prisma model to domain entity."""
        # Get chapters
        chapters = [
            Chapter(
                title=c.title,
                url=c.url,
                order=c.orderIndex,
                content=c.content
            ) for c in sorted(db_novel.chapters, key=lambda x: x.orderIndex)
        ]

        # Get author
        author = None
        if db_novel.author:
            author = Author(
                name=db_novel.author.name,
                description=db_novel.author.description
            )

        # Get genres
        genres = []
        for join in db_novel.genres:
            genre = getattr(join, "genre", None)
            if genre:
                genres.append(Genre(name=genre.name, description=genre.description))

        return Novel(
            title=db_novel.title,
            url=db_novel.url,
            author=author,
            description=db_novel.description,
            status=db_novel.status,
            genres=genres,
            chapters=chapters
        )

    async def save_novel(self, novel: Novel) -> None:
        logger.info(f"Saving novel: {novel.title}")

        # Handle Author
        db_author = None
        if novel.author:
            existing_author = await self.db.author.find_unique(
                where={"name": novel.author.name}
            )
            if existing_author:
                db_author = existing_author
                if novel.author.description and not existing_author.description:
                    db_author = await self.db.author.update(
                        where={"id": existing_author.id},
                        data={"description": novel.author.description}
                    )
            else:
                db_author = await self.db.author.create(
                    data={
                        "name": novel.author.name,
                        "description": novel.author.description
                    }
                )

        # Handle Genres
        db_genres = []
        for genre in novel.genres:
            existing_genre = await self.db.genre.find_unique(
                where={"name": genre.name}
            )
            if existing_genre:
                db_genres.append(existing_genre)
            else:
                new_genre = await self.db.genre.create(
                    data={
                        "name": genre.name,
                        "description": genre.description
                    }
                )
                db_genres.append(new_genre)

        # Check if novel exists
        existing_novel = await self.db.novel.find_unique(
            where={"url": novel.url},
            include={"chapters": True, "author": True, "genres": True}
        )

        if existing_novel:
            logger.debug(f"Novel already exists, updating: {novel.title}")
            # Build update data
            update_data = {
                "title": novel.title,
                "description": novel.description,
                "status": novel.status,
            }
            if db_author:
                update_data["authorId"] = db_author.id

            updated_novel = await self.db.novel.update(
                where={"id": existing_novel.id},
                data=update_data
            )

            # Update genres
            if db_genres:
                await self.db.noveltogenre.delete_many(
                    where={"novelId": existing_novel.id}
                )
                await self.db.noveltogenre.create_many(
                    data=[
                        {"novelId": existing_novel.id, "genreId": g.id}
                        for g in db_genres
                    ],
                    skip_duplicates=True,
                )

            # Handle chapters
            existing_chapter_urls = {c.url for c in existing_novel.chapters}

            for chapter in novel.chapters:
                if chapter.url not in existing_chapter_urls:
                    await self.db.chapter.create(
                        data={
                            "title": chapter.title,
                            "url": chapter.url,
                            "content": chapter.content,
                            "orderIndex": chapter.order,
                            "novel": {"connect": {"id": existing_novel.id}}
                        }
                    )
                elif chapter.content:
                    # Update content if provided
                    await self.db.chapter.update(
                        where={"url": chapter.url},
                        data={"content": chapter.content}
                    )
        else:
            logger.debug(f"Creating new novel: {novel.title}")
            # Build create data
            create_data = {
                "title": novel.title,
                "url": novel.url,
                "description": novel.description,
                "status": novel.status,
                "chapters": {
                    "create": [
                        {
                            "title": c.title,
                            "url": c.url,
                            "content": c.content,
                            "orderIndex": c.order
                        }
                        for c in novel.chapters
                    ]
                }
            }

            if db_author:
                create_data["authorId"] = db_author.id

            created_novel = await self.db.novel.create(data=create_data)

            if db_genres:
                await self.db.noveltogenre.create_many(
                    data=[
                        {"novelId": created_novel.id, "genreId": g.id}
                        for g in db_genres
                    ],
                    skip_duplicates=True,
                )

        logger.info("Novel saved successfully.")

    async def get_novel_by_url(self, url: str) -> Optional[Novel]:
        db_novel = await self.db.novel.find_unique(
            where={"url": url},
            include={
                "chapters": True,
                "author": True,
                "genres": {"include": {"genre": True}},
            }
        )
        if not db_novel:
            return None
        return self._to_domain_novel(db_novel)

    async def save_chapter_content(self, chapter_url: str, content: str) -> None:
        db_chapter = await self.db.chapter.find_first(
            where={"url": chapter_url}
        )
        if db_chapter:
            await self.db.chapter.update(
                where={"id": db_chapter.id},
                data={"content": content}
            )
            logger.info(f"Saved content for chapter: {chapter_url}")
        else:
            logger.warning(f"Chapter not found in DB: {chapter_url}")

    async def commit(self) -> None:
        """Commit is a no-op for Prisma as it uses auto-commit."""
        pass

    async def rollback(self) -> None:
        """Rollback is a no-op for Prisma as it uses auto-commit."""
        pass
