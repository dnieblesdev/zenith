# Zenith Scraper

## Propósito

Web scraper para extraer información de novelas de sitios como **novelfire.net** y **novelbin.com**. Scrappea metadatos (título, autor, géneros, descripción, capítulos) y contenido de capítulos.

## Stack Tecnológico

- **Python 3.10+**
- **Playwright**: Scraping con navegador headless
- **SQLAlchemy + MariaDB**: Persistencia de datos
- **Dependency Injection**: Contenedor simple para inyectar dependencias

## Estructura del Proyecto

```
src/
├── domain/entities/        # Entidades del dominio (DDD)
│   ├── novel.py          # Novel (agregado raíz)
│   ├── chapter.py        # Chapter
│   ├── author.py         # Author
│   └── genre.py          # Genre
├── application/
│   ├── ports/            # Interfaces/contratos
│   │   ├── scraper_port.py    # Interfaz para scrapers
│   │   └── repository_port.py # Interfaz para repositorios
│   └── services/
│       └── novel_service.py   # Lógica de negocio
├── adapters/
│   ├── scraping/
│   │   └── playwright_scraper.py  # Implementación scraper
│   ├── persistence/
│   │   ├── orm_models.py          # Modelos SQLAlchemy
│   │   └── mariadb_repository.py  # Implementación repositorio
│   └── cli/
│       └── commands.py             # CLI commands
└── infrastructure/
    ├── database.py         # Configuración SQLAlchemy
    └── di_container.py    # Contenedor DI
```

## Entidades del Dominio

### Novel
```python
@dataclass
class Novel:
    title: str           # Título de la novela
    url: str            # URL única
    author: Author      # Relación a Author
    description: str    # Sinopsis
    status: str         # e.g., "Ongoing", "Completed"
    genres: List[Genre] # Relación muchos a muchos
    chapters: List[Chapter]
```

### Chapter
```python
@dataclass
class Chapter:
    title: str       # Título del capítulo
    url: str         # URL del capítulo
    order: int       # Orden en la novela
    content: str     # Contenido del capítulo (opcional)
```

## Flujo de Ejecución

1. **Entrada**: `main.py` recibe URL por CLI
2. **Inicialización**: `DIContainer` crea las dependencias (scraper, repository, service)
3. **Scraping**: `NovelService.scrape_and_save_novel()` llama al scraper
4. **Persistencia**: El scraper retorna objeto `Novel`, el service lo guarda en MariaDB

## Puertos (Interfaces)

### ScraperPort
```python
class ScraperPort(Protocol):
    def get_novel(url: str, max_pages: Optional[int] = None) -> Novel: ...
    def get_chapter_content(url: str) -> str: ...
```

### RepositoryPort
```python
class RepositoryPort(Protocol):
    def save_novel(novel: Novel) -> None: ...
    def get_novel_by_url(url: str) -> Optional[Novel]: ...
    def save_chapter_content(chapter_url: str, content: str) -> None: ...
```

## CLI

```bash
# Scrape metadata de novela
python main.py "https://novelfire.net/book/some-novel"

# Scrape un capítulo específico
python main.py "https://novelfire.net/chapter/..." --chapter

# Scrape todos los capítulos de una novela
python main.py "https://novelfire.net/book/..." --scrape-chapters
```

## Configuración

Variables de entorno en `.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=zenith_scraper
```

## Instalación

```bash
pip install -r requirements.txt
playwright install chromium
python main.py  # Crea las tablas automáticamente
```

## Sitios Soportados

- **novelfire.net**: Scraper completo (metadata + capítulos)
- **novelbin.com**: Scraper básico (estructura similar)

## Notas

- El scraper usa stealth scripts para evitar detección
- Rate limiting: 2-5 segundos entre requests, pausa extendida cada 200 capítulos
- Los capítulos sin contenido se scrapean progresivamente
