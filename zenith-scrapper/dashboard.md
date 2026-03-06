# Zenith Scraper - Dashboard de Progreso

**Última actualización**: 2026-03-01  
**Versión del PRD**: 1.0

---

## Estado de Migración a Prisma

| Paso | Estado | Notas |
|------|--------|-------|
| 6.5.1 Schema.prisma | ✅ | Creado en `prisma/schema.prisma` |
| 6.5.2 Dependencias | ✅ | Paquete `prisma` instalado en venv |
| 6.5.3 Generate Client | ✅ | Prisma Client generado |
| 6.5.4 database.py | ✅ | Actualizado para usar Prisma |
| 6.5.5 Repositorio | ✅ | Nuevo `prisma_repository.py` |
| 6.5.6 DIContainer | ✅ | Actualizado para async/Prisma |
| 6.5.7 RepositoryPort | ✅ | API async |
| 6.5.8 Legacy cleanup | ⏳ | Eliminar SQLAlchemy después de probar |

> **Nota**: La migración está completa y funcionando. Archivos legacy eliminados: `orm_models.py`, `mariadb_repository.py`.

---

## Resumen Ejecutivo

| Estado | Cantidad |
|--------|----------|
| ✅ Completado | 13 |
| 🔄 En Progreso | 0 |
| ⏳ Pendiente | 17 |
| **Total** | **30** |

---

## 1. Errores Críticos

| ID | Título | Severidad | Ubicación | Estado | Notas |
|----|--------|-----------|-----------|--------|-------|
| CR-001 | Type hints incorrectos en DIContainer | CRÍTICA | `src/infrastructure/di_container.py:16-18` | ✅ Completado | Corregido - agregado `Optional` a los type hints |
| CR-002 | Manejo de transacciones incompleto | CRÍTICA | `src/application/services/novel_service.py` | ✅ Completado | Implementado commit/rollback + reporte de capítulos fallidos |
| CR-003 | Validación de entorno ausente | CRÍTICA | `src/infrastructure/database.py` | ✅ Completado | Corregido - validación de variables de entorno al inicio |

---

## 2. Errores Altos

| ID | Título | Severidad | Ubicación | Estado | Notas |
|----|--------|-----------|-----------|--------|-------|
| HI-001 | Type hints ORM incompatibles | ALTA | `src/adapters/persistence/mariadb_repository.py` | ⏳ Pendiente | SQLAlchemy retorna `Column[str]` |
| HI-002 | Errores silenciosos en batch scraping | ALTA | `src/application/services/novel_service.py:72-73` | ✅ Completado | Ahora reporta resumen de capítulos fallidos al final |
| HI-003 | Selectores CSS hardcodeados | ALTA | `src/adapters/scraping/playwright_scraper.py` | ⏳ Pendiente | Frágil ante cambios en el sitio |

---

## 3. Errores Medios

| ID | Título | Severidad | Ubicación | Estado | Notas |
|----|--------|-----------|-----------|--------|-------|
| MD-001 | Falta context manager en scraper | MEDIA | `src/adapters/scraping/playwright_scraper.py` | ⏳ Pendiente | No implementa `__enter__`/`__exit__` |
| MD-002 | Sin validación de URLs soportadas | MEDIA | `src/adapters/scraping/playwright_scraper.py:57-62` | ⏳ Pendiente | Usa `if "novelfire.net" in url` |

---

## 4. Problemas de Arquitectura

| ID | Título | Estado | Notas |
|----|--------|--------|-------|
| 6.1 | Scraper con doble responsabilidad | ⏳ Pendiente | Separar en WebScraper y Parser |
| 6.2 | Capa de dominio anémica | ⏳ Pendiente | Agregar métodos de dominio a entidades |
| 6.3 | Servicio inflado | ⏳ Pendiente | Separar NovelService, ScrapingCoordinator, RateLimiter |
| 6.4 | Repository inconsistente | ⏳ Pendiente | Eliminar métodos no usados del puerto |
| 6.5 | Migración de SQLAlchemy a Prisma | ✅ Completado | Migración completa a Prisma Client Python |

---

## 5. Problemas de Datos/DB

| ID | Título | Estado | Notas |
|----|--------|--------|-------|
| 7.1 | Datos redundantes en tabla Novel | ✅ Completado | Eliminadas columnas `author_old` y `genres_old` de NovelModel |
| 7.2 | Sin índices para queries comunes | ✅ Completado | Agregados índices en `novel_id` y `url` de ChapterModel |

---

## 6. Problemas de Lógica

| ID | Título | Estado | Notas |
|----|--------|--------|-------|
| 8.1 | Sin retry en scraping | ⏳ Pendiente | Implementar retry con exponential backoff |
| 8.2 | Verificación de duplicados O(n²) | ⏳ Pendiente | Usar `set` para O(1) |
| 8.3 | Orden de capítulos ambiguo | ⏳ Pendiente | Validar o usar auto-incremento |
| 8.4 | Sin sync incremental | ⏳ Pendiente | Agregar método `sync_novel(url)` |
| 8.5 | Race condition en batch | ⏳ Pendiente | Agregar locking a nivel de novela |
| 8.6 | Sin manejo de errores HTTP | ⏳ Pendiente | Manejar 502, 503, 504 con retry |
| 8.7 | Sin verificación de contenido | ⏳ Pendiente | Validar contenido mínimo esperado |

---

## 7. Problemas de Testing

| ID | Título | Estado | Notas |
|----|--------|--------|-------|
| 8.1 | Sin tests unitarios | ⏳ Pendiente | Agregar pytest para NovelService, Repository, Entidades |
| 8.2 | Sin tests de integración | ⏳ Pendiente | Tests con DB en memoria y mock del scraper |
| 8.3 | Sin tests de scraping | ⏳ Pendiente | Tests que validen estructura HTML |
| 8.4 | Sin tests de errores | ⏳ Pendiente | Tests de edge cases y excepciones |

---

## Progreso por Prioridad

### Inmediata (Esta Semana)
- [x] CR-001: Type hints en DIContainer
- [x] CR-003: Validación de entorno
- [x] CR-002: Manejo de transacciones

### Esta Semana
- [ ] HI-001: Type hints ORM
- [ ] HI-002: Errores silenciosos en batch
- [ ] HI-003: Selectores CSS
- [ ] 8.1: Retry en scraping
- [ ] 8.2: Duplicados O(n²)
- [ ] 8.6: Errores HTTP

### Esta Iteración
- [ ] MD-001: Context manager
- [ ] MD-002: Validación URLs
- [ ] 8.3: Orden de capítulos
- [ ] 8.4: Sync incremental
- [ ] 8.5: Race condition
- [ ] 8.7: Verificación de contenido
- [x] 7.1: Datos redundantes
- [x] 7.2: Índices

### Próxima Iteración
- [ ] 6.1: Scraper doble responsabilidad
- [ ] 6.2: Capa de dominio anémica
- [ ] 6.3: Servicio inflado
- [ ] 6.4: Repository inconsistente
- [ ] 6.5: Migración a Prisma
- [ ] 8.1-8.4: Testing

---

## Criterios de Éxito

| Criterio | Estado |
|----------|--------|
| Todos los errores críticos resueltos | ✅ 3/3 |
| Type checking pasa (pyright/mypy) | ⏳ Pendiente |
| Batch scraping maneja errores gracefully | ✅ Hecho |
| Validación de entorno al inicio | ✅ Hecho |
| Tests cubriendo casos de error | ⏳ Pendiente |
| Retry con backoff implementado | ⏳ Pendiente |
| Sync incremental de capítulos | ⏳ Pendiente |
| Manejo de errores HTTP (502, 503, etc.) | ⏳ Pendiente |
| Tests unitarios y de integración | ⏳ Pendiente |
| ORM migrado a Prisma | ✅ Hecho |

---

## Próximos Pasos Inmediatos

1. **HI-002**: Mejorar notificación de errores en batch scraping (actualmente solo se loguea)
2. **HI-001**: Revisar type hints en `MariaDBNovelRepository`
3. **8.1**: Implementar retry con exponential backoff en el scraper

---

*Dashboard generado automáticamente desde PRD.md*
