# Product Requirement Document - Zenith Scraper

## 1. Información General

**Proyecto**: Zenith Scraper  
**Tipo**: Web Scraper para novelas  
**Fecha**: 2026-02-28  
**Versión**: 1.0

---

## 2. Problemas Identificados

### 2.1 Errores Críticos

| ID | Título | Severidad | Ubicación | Descripción |
|----|--------|-----------|-----------|-------------|
| CR-001 | Type hints incorrectos en DIContainer | CRÍTICA | `src/infrastructure/di_container.py:16-18` | Los atributos `_db_session`, `_scraper`, `_repository` usan `= None` pero el tipo declarado no es `Optional`. Causa errores de type checking. |
| CR-002 | Manejo de transacciones incompleto | CRÍTICA | `src/application/services/novel_service.py` | Si el scraping falla entre operaciones, la DB queda en estado inconsistente. No hay rollback. |
| CR-003 | Validación de entorno ausente | CRÍTICA | `src/infrastructure/database.py` | Si las variables de entorno no están definidas, el proyecto falla con error críptico sin mensaje claro. |

### 2.2 Errores Altos

| ID | Título | Severidad | Ubicación | Descripción |
|----|--------|-----------|-----------|-------------|
| HI-001 | Type hints ORM incompatibles | ALTA | `src/adapters/persistence/mariadb_repository.py` | SQLAlchemy retorna `Column[str]` en lugar de `str`. El type checker no reconoce el mapping. |
| HI-002 | Errores silenciosos en batch scraping | ALTA | `src/application/services/novel_service.py:72-73` | Los capítulos que fallan solo se loguean, el loop continúa sin notificación clara. |
| HI-003 | Selectores CSS hardcodeados | ALTA | `src/adapters/scraping/playwright_scraper.py` | Los selectores son frágiles. Si el sitio cambia el HTML, el scraper falla sin mensaje claro. |

### 2.3 Errores Medios

| ID | Título | Severidad | Ubicación | Descripción |
|----|--------|-----------|-----------|-------------|
| MD-001 | Falta context manager en scraper | MEDIA | `src/adapters/scraping/playwright_scraper.py` | `PlaywrightScraper` no implementa `__enter__`/`__exit__`. Recursos pueden quedar abiertos si se usa fuera del DIContainer. |
| MD-002 | Sin validación de URLs soportadas | MEDIA | `src/adapters/scraping/playwright_scraper.py:57-62` | El check `if "novelfire.net" in url` es frágil. Mejor usar regex o Enum de sitios soportados. |

---

## 3. Propuestas de Solución

### CR-001: Type Hints DIContainer

```python
from typing import Optional
from sqlalchemy.orm import Session

class DIContainer:
    _db_session: Optional[Session] = None
    _scraper: Optional[ScraperPort] = None
    _repository: Optional[RepositoryPort] = None
```

### CR-002: Transacciones

```python
def scrape_all_chapters(self, novel_url: str) -> None:
    try:
        # operaciones
        self.repository.commit()
    except Exception as e:
        self.repository.rollback()
        raise
```

### CR-003: Validación de Entorno

```python
def get_database_url():
    required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise EnvironmentError(f"Faltan variables: {', '.join(missing)}")
    # ...
```

---

## 6. Problemas de Arquitectura

### 6.1 Scraper con doble responsabilidad

**Ubicación**: `src/adapters/scraping/playwright_scraper.py`

**Problema**: `PlaywrightScraper` hace scraping Y parsing de HTML en la misma clase. Esto viola el principio de responsabilidad única.

**Solución**: Separar en:
- `WebScraper`: solo obtener HTML (Playwright)
- `NovelParser`: extrae datos del HTML
- `ChapterParser`: extrae contenido del capítulo

---

### 6.2 Capa de dominio anémica

**Ubicación**: `src/domain/entities/`

**Problema**: Las entidades (`Novel`, `Chapter`) son solo `dataclass` sin comportamiento. No hay lógica de dominio.

**Solución**: Agregar métodos de dominio:
```python
@dataclass
class Novel:
    def add_chapter(self, chapter: Chapter) -> None: ...
    def get_chapter_by_order(self, order: int) -> Optional[Chapter]: ...
    def has_chapter(self, url: str) -> bool: ...
```

---

### 6.3 Servicio inflado

**Ubicación**: `src/application/services/novel_service.py`

**Problema**: `NovelService` mezcla:
- Coordinación scraper ↔ repository
- Rate limiting
- Retry logic
- Logging de progreso

**Solución**: Separar en:
- `NovelService`: solo lógica de negocio
- `ScrapingCoordinator`: maneja flujo de scraping
- `RateLimiter`: control de velocidad

---

### 6.4 Repository inconsistente

**Ubicación**: `src/application/ports/repository_port.py` vs uso real

**Problema**: El puerto define `get_author_by_name` y `get_genre_by_name`, pero nunca se usan en el servicio.

**Solución**: Eliminar métodos no usados del puerto.

---

### 6.5 Migración de SQLAlchemy a Prisma

**Ubicación**: `src/infrastructure/database.py`, `src/adapters/persistence/orm_models.py`, `src/adapters/persistence/mariadb_repository.py`

**Problema**: Actualmente se usa SQLAlchemy como ORM. Se requiere migrar a **Prisma** (Prisma Client Python) para mejor productividad y type safety.

**Cambios requeridos**:

1. **Eliminar**:
   - `src/adapters/persistence/orm_models.py` (modelos SQLAlchemy)
   - `src/infrastructure/database.py` (configuración SQLAlchemy)
   - Uso de `sqlalchemy.Column`, `sqlalchemy.relationship`, etc.

2. **Agregar**:
   - `prisma/schema.prisma` (definición del schema)
   - Generar Prisma Client
   - Nuevo repositorio usando Prisma Client

3. **Ejemplo del nuevo schema**:
   ```prisma
   // prisma/schema.prisma
   generator client {
     provider = "prisma-client-py"
   }
   
   datasource db {
     provider = "mysql"
     url      = env("DATABASE_URL")
   }
   
   model Author {
     id          Int      @id @default(autoincrement())
     name        String   @unique
     description String?
     novels      Novel[]
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
   }
   
   model Genre {
     id          Int      @id @default(autoincrement())
     name        String   @unique
     description String?
     novels      Novel[]
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
   }
   
   model Novel {
     id          Int       @id @default(autoincrement())
     title       String
     url         String    @unique
     description String?
     status      String?
     author      Author?   @relation(fields: [authorId], references: [id])
     authorId    Int?
     genres      Genre[]
     chapters    Chapter[]
     createdAt   DateTime  @default(now())
     updatedAt   DateTime  @updatedAt
   }
   
   model Chapter {
     id          Int      @id @default(autoincrement())
     title       String
     url         String
     content     String?  @db.LongText
     orderIndex  Int
     novel       Novel    @relation(fields: [novelId], references: [id], onDelete: Cascade)
     novelId     Int
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
   
     @@index([novelId])
   }
   ```

4. **Nuevo repositorio con Prisma**:
   ```python
   from prisma import Prisma
   
   class PrismaNovelRepository(RepositoryPort):
       def __init__(self, db: Prisma):
           self.db = db
       
       async def save_novel(self, novel: Novel) -> None:
           await self.db.novel.upsert(
               where={'url': novel.url},
               data={
                   'create': {
                       'title': novel.title,
                       'url': novel.url,
                       'description': novel.description,
                       'status': novel.status,
                       # ...
                   },
                   'update': { ... }
               }
           )
   ```

**Nota**: Prisma Client Python es async por defecto, por lo que se requiere adaptar el código a async/await.

---

## 7. Problemas de Datos/DB

### 7.1 Datos redundantes en tabla Novel

**Ubicación**: `src/adapters/persistence/orm_models.py`

**Problema**: La tabla `Novel` tiene campos redundantes:
- `author_old` (String) - guarda el nombre del autor como texto
- `genres_old` (Text) - guarda los géneros como texto

Estos campos existen porque antes no había relación con las tablas `Author` y `Genre`. Ahora con la relación, estos campos son innecesarios y causan confusión.

**Solución**:
1. Eliminar columnas `author_old` y `genres_old` de `NovelModel`
2. Migrar datos existentes a las tablas relacionadas
3. Eliminar código que usa estos campos legacy

---

### 7.2 Sin índices para queries comunes

**Ubicación**: `src/adapters/persistence/orm_models.py`

**Problema**: Faltan índices para queries frecuentes:
- Búsqueda de capítulos por `novel_id`
- Búsqueda de capítulo por `url`

**Solución**: Agregar índices:
```python
chapter_url = Column(String(255), nullable=False, index=True)  # Ya existe unique en Novel.url, falta en Chapter.url
```

---

## 8. Problemas de Lógica

### 8.1 Sin retry en scraping

**Ubicación**: `src/adapters/scraping/playwright_scraper.py`

**Problema**: Si una página falla (timeout, anti-bot), el scraper falla inmediatamente. No hay retry con backoff.

**Solución**:
```python
def scrape_with_retry(url: str, max_retries: int = 3) -> str:
    for attempt in range(max_retries):
        try:
            return scrape(url)
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            sleep(2 ** attempt)  # exponential backoff
```

---

### 8.2 Verificación de duplicados O(n²)

**Ubicación**: `src/adapters/scraping/playwright_scraper.py:160`

**Problema**:
```python
if not any(c.url == chapter_url for c in chapters):
```
Con 2000 capítulos = 2M comparaciones.

**Solución**: Usar `set` para O(1):
```python
existing_urls = {c.url for c in chapters}
if chapter_url not in existing_urls:
    chapters.append(...)
```

---

### 8.3 Orden de capítulos ambiguo

**Ubicación**: `src/infrastructure/orm_models.py:67`

**Problema**: Se guarda `order_index` pero no se valida que sea secuencial o único.

**Solución**: Validar o usar auto-incremento de la DB.

---

### 8.4 Sin sync incremental

**Ubicación**: `src/application/services/novel_service.py:40`

**Problema**: `scrape_all_chapters` scrapea todo o nada. No hay manera de agregar solo capítulos nuevos.

**Solución**: Agregar método `sync_novel(url)` que:
1. Obtiene capítulos de la DB
2. Obtiene capítulos del sitio
3. Solo hace scrape de los nuevos

---

### 8.5 Race condition en batch

**Ubicación**: `src/application/services/novel_service.py:40`

**Problema**: Si dos instancias corren `scrape_all_chapters` para la misma novela, ambas scrapean los mismos capítulos.

**Solución**: Agregar locking a nivel de novela o estado de scraping.

---

### 8.6 Sin manejo de errores HTTP

**Ubicación**: `src/adapters/scraping/playwright_scraper.py:55, 70`

**Problema**: Si el sitio devuelve un error HTTP (502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout) pero Cloudflare está bien, el scraper falla sin retry ni mensaje claro. Un error 502 puede ser temporal (servidor overloaded).

**Ejemplo**: El servidor de la novela responde con 502 pero Cloudflare retorna 200.

**Solución**:
```python
def _check_response(page: Page) -> None:
    """Verifica que la respuesta sea exitosa."""
    response = page.response
    if response is None:
        raise ScraperError("No response received")
    
    status = response.status
    if 400 <= status < 500:
        raise ClientError(f"HTTP {status}: Client error")
    if status >= 500:
        raise ServerError(f"HTTP {status}: Server error (retryable)")
    
    # Verificar contenido no vacío
    if response.ok and not page.content():
        raise ScraperError("Response OK but empty content")
```

Agregar retry específico para errores 5xx con backoff.

---

### 8.7 Sin verificación de contenido

**Ubicación**: `src/adapters/scraping/playwright_scraper.py`

**Problema**: No se verifica que el contenido scrapeado sea válido. Puede retornar página vacía, con CAPTCHA, o error del sitio sin detectar.

**Solución**: Agregar validaciones:
- Contenido mínimo esperado
- Detección de CAPTCHA/challenges
- Verificación de estructura HTML esperada

Agregar retry específico para errores 5xx con backoff.

---

## 10. Problemas de Testing

### 8.1 Sin tests unitarios

**Problema**: No existen tests para las entidades de dominio, servicios ni repositorios.

**Solución**: Agregar tests con pytest para:
- NovelService
- MariaDBNovelRepository
- Entidades del dominio

---

### 8.2 Sin tests de integración

**Problema**: No hay tests que prueben el flujo completo (scraper → service → repository).

**Solución**: Tests de integración con:
- DB en memoria (SQLite)
- Mock del scraper

---

### 8.3 Sin tests de scraping

**Problema**: Los selectores CSS no tienen tests. Si el sitio cambia, no se detecta hasta producción.

**Solución**: Tests que validen estructura HTML esperada.

---

### 8.4 Sin tests de errores

**Problema**: No hay tests para casos de error (timeout, 502, página vacía, etc.).

**Solución**: Tests de edge cases y manejo de excepciones.

---

## 9. Problemas de Infraestructura

### 9.1 Sin repositorio Git configurado

**Problema**: El proyecto no tiene un repositorio Git inicializado. No hay control de versiones, no hay historial de cambios, no hay posibilidad de rollback seguro.

**Severidad**: CRÍTICA

**Solución**:
1. Inicializar repositorio Git: `git init`
2. Crear `.gitignore` adecuado (incluir `venv/`, `.venv/`, `__pycache__/`, `.env`, `node_modules/`, `logs/`, `*.pyc`, `.pyre/`)
3. Crear commit inicial con el estado actual del proyecto
4. Configurar repositorio remoto (GitHub/GitLab)
5. Establecer branching strategy (al menos `main` + feature branches)

**Nota**: Sin Git, cualquier refactor o cambio significativo es de alto riesgo — no hay manera de revertir si algo sale mal.

---

## 11. Priorización Actualizada

| Prioridad | Acciones |
|----------|----------|
| **Inmediata** | CR-001, CR-003, 9.1 (Git) |
| **Esta Semana** | CR-002, HI-001, 8.1, 8.2, 8.6 |
| **Esta Iteración** | HI-002, HI-003, MD-001, MD-002, 8.3, 8.4, 8.5, 8.7, 7.1, 7.2 |
| **Próxima Iteración** | 6.1, 6.2, 6.3, 6.4, 6.5, 7.5, 8.1, 8.2 |

---

## 12. Criterios de Éxito

- [ ] Repositorio Git configurado con .gitignore
- [ ] Todos los errores críticos resueltos
- [ ] Type checking pasa (pyright/mypy)
- [ ] Batch scraping maneja errores gracefully
- [ ] Validación de entorno al inicio
- [ ] Tests cubriendo casos de error
- [ ] Retry con backoff implementado
- [ ] Sync incremental de capítulos
- [ ] Manejo de errores HTTP (502, 503, etc.)
- [ ] Tests unitarios y de integración
- [ ] ORM migrado a Prisma
