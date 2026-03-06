# AGENTS.md — zenith-scrapper

Instrucciones específicas para operar en el subproyecto `zenith-scrapper`. Leé el `AGENTS.md` raíz primero para el contexto global.

---

## Qué hace este subproyecto

Scraper Python que obtiene contenido de novelas web y lo persiste en MariaDB. Usa Playwright para el scraping y Prisma Client Python como ORM.

**Es el único proceso que escribe en las tablas de contenido.** `zenith-api` nunca debe tocar `Author`, `Genre`, `Novel`, ni `Chapter`.

---

## Stack

| Herramienta | Uso |
|-------------|-----|
| Python 3.10+ | Runtime |
| Playwright | Automatización de browser (Chromium) |
| Prisma Client Python | ORM — source of truth del schema |
| loguru | Logging |
| pytest | Testing |
| pyright | Type checking estático |

---

## Estructura del proyecto (DDD)

```
zenith-scrapper/
├── main.py                        ← Punto de entrada / CLI
├── prisma/
│   └── schema.prisma              ← SOURCE OF TRUTH del schema (único en el repo)
├── src/
│   ├── domain/
│   │   └── entities/              ← Novel, Chapter, Author, Genre (dataclasses)
│   ├── application/
│   │   ├── ports/                 ← Interfaces abstractas (ScraperPort, RepositoryPort)
│   │   └── services/              ← Lógica de negocio (NovelService)
│   ├── adapters/
│   │   ├── scraping/              ← Implementación Playwright (novelfire, novelbin)
│   │   └── persistence/           ← PrismaRepository — escribe en DB via Prisma
│   ├── infrastructure/
│   │   └── di_container.py        ← Contenedor de dependencias
│   └── utils/
│       └── logger.py              ← Logger loguru
└── tests/
    ├── test_domain_entities.py
    ├── test_parsers.py
    ├── test_scraping_coordinator.py
    └── test_rate_limiter.py
```

---

## Comandos

### Instalación

```bash
pip install -r requirements.txt
playwright install chromium
```

### Ejecutar el scraper

```bash
# Scrapear metadata de una novela
python main.py "https://novelfire.net/book/some-novel"

# Scrapear todos los capítulos de una novela
python main.py "https://novelfire.net/book/..." --scrape-chapters

# Scrapear un capítulo específico
python main.py "https://novelfire.net/chapter/..." --chapter
```

### Tests

```bash
# Todos los tests
pytest

# Un archivo específico
pytest tests/test_parsers.py

# Un test específico con verbose
pytest tests/test_parsers.py::nombre_del_test -v

# Con coverage
pytest --cov=src
```

### Type checking

```bash
pyright src/
```

### Prisma — generar cliente Python

```bash
# Después de modificar schema.prisma
prisma generate --schema=prisma/schema.prisma
```

---

## Convenciones de código

### Imports

```python
# Orden: stdlib → third-party → local
from typing import Optional, List
from dataclasses import dataclass, field

from playwright.sync_api import sync_playwright
from prisma import Prisma

from src.domain.entities import Novel
from src.application.ports import ScraperPort
from src.utils.logger import get_logger
```

### Naming

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Clases | PascalCase | `NovelService`, `PrismaRepository` |
| Funciones/métodos | snake_case | `scrape_and_save_novel` |
| Variables | snake_case | `chapter_url` |
| Constantes | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Métodos privados | _leading_underscore | `_parse_chapter` |

### Types

```python
# Usar Optional[X] (no X | None) para compatibilidad Python 3.10
def get_novel(self, url: str) -> Optional[Novel]: ...

# Usar List[X] de typing (no list[X])
def get_chapters(self) -> List[Chapter]: ...

# Dataclasses para entidades del dominio
@dataclass
class Novel:
    title: str
    url: str
    author: Optional[Author] = None
    chapters: List[Chapter] = field(default_factory=list)
```

### Error handling

```python
# Cleanup con try/finally
def scrape_chapter(self, url: str) -> str:
    page = self.context.new_page()
    try:
        page.goto(url, timeout=60000)
        # ...
    except Exception as e:
        logger.error(f"Failed to scrape chapter {url}: {e}")
        raise
    finally:
        page.close()
```

### Ports y adapters

```python
# Puerto (interfaz abstracta en application/ports/)
class RepositoryPort(ABC):
    @abstractmethod
    async def save_novel(self, novel: Novel) -> None: ...

# Implementación (en adapters/persistence/)
class PrismaRepository(RepositoryPort):
    async def save_novel(self, novel: Novel) -> None: ...
```

---

## Reglas críticas — NO romper

- ❌ **NO agregar lógica de negocio** — el scrapper solo scrapea y persiste, nada más
- ❌ **NO crear un segundo schema Prisma** — el único schema es `prisma/schema.prisma`
- ❌ **NO modificar tablas de `Suggestion`, `Correction`, `Vote`, `User`** — son propiedad de la API
- ❌ **NO usar SQLAlchemy** — el proyecto migró a Prisma Client Python
- ✅ Toda modificación al schema va en `prisma/schema.prisma` y luego se regenera el cliente

---

## Variables de entorno

```env
DATABASE_URL="mysql://user:password@localhost:3306/zenith"
```

Crear archivo `.env` en la raíz de `zenith-scrapper/`. No commitearlo.

---

## Sitios soportados en v1

- `novelfire.net`
- `novelbin.com`

Para agregar un nuevo sitio: crear parser en `src/adapters/scraping/` siguiendo el patrón de `novelfire_parser.py` o `novelbin_parser.py`, y registrarlo en `scraping_coordinator.py`.
