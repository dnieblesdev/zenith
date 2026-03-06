# Product Requirement Document — Zenith

**Versión**: 1.1  
**Fecha**: 2026-03-05  
**Estado**: Draft  
**Autor**: Zenith Team

---

## 1. Visión del Producto

**Zenith** es una plataforma de lectura de novelas web que combina scraping automatizado de contenido con edición colaborativa impulsada por la comunidad.

La propuesta de valor central es que **los lectores son los editores**: en lugar de depender de traductores o correctores centralizados, Zenith permite que la comunidad sugiera mejoras a los textos, vote las mejores correcciones, y estas se apliquen automáticamente cuando alcanzan consenso.

Zenith ofrece contenido en **inglés y español** de forma nativa. Para otros idiomas, el usuario puede apoyarse en el traductor del navegador u herramientas similares — Zenith no bloquea eso, simplemente no lo gestiona.

> "El mejor traductor de una novela es alguien que la leyó completa tres veces."

---

## 2. Problema que Resuelve

Las plataformas actuales de lectura de novelas web tienen tres problemas estructurales:

| Problema | Descripción |
|----------|-------------|
| **Calidad de traducción** | Las traducciones automáticas o de baja calidad no tienen mecanismo de corrección colaborativa |
| **Barrera de idioma** | Los lectores hispanohablantes no tienen una plataforma de novelas web con contenido nativo en español de calidad |
| **Pasividad del lector** | Los lectores no tienen forma de contribuir más allá de comentarios que nadie lee |
| **Falta de incentivos** | No existe reconocimiento para quienes hacen el trabajo de mejorar el contenido |

Zenith resuelve esto con un sistema editorial donde las sugerencias de la comunidad son la principal fuente de mejora del contenido, y los usuarios que contribuyen ganan visibilidad y reconocimiento dentro de la plataforma.

---

## 3. Usuarios y Roles

### 3.1 Roles del sistema

| Rol | Descripción | Permisos clave |
|-----|-------------|----------------|
| **Lector anónimo** | Navega y lee sin registrarse | Leer novelas y capítulos |
| **Lector registrado** | Usuario con cuenta | Leer + sugerir correcciones + votar |
| **Editor destacado** | Lector con alta tasa de aceptación | Badge especial + visibilidad en la plataforma |
| **Admin** | Gestor del sistema | Gestión de novelas, moderación, configuración de umbrales |

### 3.2 User Personas

**Lucas — el lector frustrado**  
Lee novelas de fantasía asiática. Le molestan los errores de traducción recurrentes pero no tiene donde reportarlos de forma que importe. Si pudiera corregirlos y que otros vieran su nombre, lo haría.

**Sofía — la lectora comprometida**  
Lee 3-4 novelas en paralelo. Ya tiene experiencia con traducciones y sabe distinguir una mala construcción de una buena. Quiere contribuir pero no quiere administrar nada.

---

## 4. Componentes del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        ZENITH ECOSYSTEM                         │
│                                                                 │
│  ┌─────────────────┐          ┌──────────────────────────────┐  │
│  │ zenith-scrapper │          │         MariaDB              │  │
│  │                 │─ escribe▶│                              │  │
│  │ Python          │          │  novels / chapters / authors │  │
│  │ Playwright      │          │  genres / users / suggestions│  │
│  │ Prisma (Python) │          │  corrections / votes         │  │
│  └─────────────────┘          └──────────────┬───────────────┘  │
│                                              │ lee              │
│                               ┌──────────────▼───────────────┐  │
│                               │        zenith-api            │  │
│                               │                              │  │
│                               │  Hono.js (TypeScript)        │  │
│                               │  Prisma (TypeScript)         │  │
│                               │  Bun runtime                 │  │
│                               └──────┬───────────────────────┘  │
│                                      │ REST / JSON              │
│                          ┌───────────┴──────────┐               │
│                          │                      │               │
│              ┌───────────▼──────┐   ┌───────────▼──────────┐   │
│              │   zenith-web     │   │   zenith-mobile      │   │
│              │                  │   │                      │   │
│              │  Angular 19      │   │  Expo (React Native) │   │
│              │  Standalone      │   │  Bun (deps)          │   │
│              │  Bun             │   │                      │   │
│              └──────────────────┘   └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Regla fundamental de acceso a datos

- `zenith-scrapper` **solo escribe** en las tablas de contenido: `Author`, `Genre`, `Novel`, `Chapter`
- `zenith-api` **nunca modifica** `chapter.content` — ese campo es propiedad exclusiva del scraper
- Las correcciones de la comunidad viven en tablas separadas (`Suggestion`, `Correction`) y se renderizan como una capa encima del contenido raw

---

## 5. Funcionalidades por Componente

### 5.1 zenith-scrapper

**Responsabilidad**: Obtener y persistir contenido de novelas desde sitios externos.

| ID | Funcionalidad | Prioridad |
|----|---------------|-----------|
| SC-001 | Scraping de metadata de novela (título, autor, géneros, descripción, estado) | Alta |
| SC-002 | Scraping de lista de capítulos con paginación | Alta |
| SC-003 | Scraping de contenido de capítulo individual | Alta |
| SC-004 | Sync incremental: detectar y scrapear solo capítulos nuevos | Alta |
| SC-005 | Retry con exponential backoff ante errores HTTP 5xx | Alta |
| SC-006 | Detección de CAPTCHA y Cloudflare challenge | Media |
| SC-007 | Soporte multi-sitio: novelfire.net, novelbin.com (extensible) | Media |
| SC-008 | Rate limiting configurable por sitio | Media |
| SC-009 | CLI para operación manual y automatización via cron | Alta |

**Sitios soportados en v1**: novelfire.net, novelbin.com

---

### 5.2 zenith-api

**Responsabilidad**: Exponer el contenido de la DB y gestionar toda la lógica editorial y de usuarios.

#### Módulo: Catálogo

| ID | Endpoint | Descripción |
|----|----------|-------------|
| AP-001 | `GET /novels` | Listar novelas con paginación y filtros (género, estado, búsqueda, **idioma**) |
| AP-002 | `GET /novels/:id` | Detalle de novela con metadata completa |
| AP-003 | `GET /novels/:id/chapters` | Lista de capítulos de una novela |
| AP-004 | `GET /chapters/:id` | Contenido de un capítulo (con correcciones aplicadas) |

#### Módulo: Usuarios y Auth

| ID | Endpoint | Descripción |
|----|----------|-------------|
| AP-010 | `POST /auth/register` | Registro de nuevo usuario |
| AP-011 | `POST /auth/login` | Login, retorna JWT |
| AP-012 | `POST /auth/logout` | Invalidar sesión |
| AP-013 | `GET /users/:id/profile` | Perfil público de usuario (sugerencias aceptadas, badges) |

#### Módulo: Sistema Editorial

| ID | Endpoint | Descripción |
|----|----------|-------------|
| AP-020 | `POST /chapters/:id/suggestions` | Crear sugerencia para un párrafo |
| AP-021 | `GET /chapters/:id/suggestions` | Listar sugerencias de un capítulo |
| AP-022 | `POST /suggestions/:id/vote` | Votar una sugerencia (un voto por usuario) |
| AP-023 | `DELETE /suggestions/:id/vote` | Retirar voto de una sugerencia |
| AP-024 | `GET /suggestions/:id` | Detalle de una sugerencia con votos y estado |

#### Módulo: Admin

| ID | Endpoint | Descripción |
|----|----------|-------------|
| AP-030 | `POST /admin/novels` | Registrar novela para scraping |
| AP-031 | `PUT /admin/novels/:id` | Editar metadata de novela |
| AP-032 | `POST /admin/novels/:id/sync` | Forzar sync del scraper para una novela |
| AP-033 | `PUT /admin/suggestions/:id/status` | Aprobar o rechazar sugerencia manualmente |
| AP-034 | `GET /admin/stats` | Estadísticas generales del sistema |

---

### 5.3 zenith-web

**Responsabilidad**: Interfaz principal de lectura y participación editorial.

**Framework**: Angular 19 con componentes standalone, signals, y Angular Router. SSR habilitado via Angular Universal para SEO y tiempo de carga inicial.

#### Páginas

| ID | Ruta | Descripción |
|----|------|-------------|
| WB-001 | `/` | Home: novelas destacadas, últimas actualizaciones |
| WB-002 | `/novels` | Catálogo con filtros por género, estado, búsqueda e **idioma** |
| WB-003 | `/novels/:slug` | Detalle de novela: metadata, lista de capítulos |
| WB-004 | `/novels/:slug/:chapter` | Lector de capítulo |
| WB-005 | `/users/:username` | Perfil público: sugerencias aceptadas, badges, ranking |
| WB-006 | `/login` `/register` | Autenticación |
| WB-007 | `/admin` | Panel de administración (solo admin) |

#### Funcionalidades del lector (WB-004)

| ID | Funcionalidad | Descripción |
|----|---------------|-------------|
| WB-010 | Renderizado con correcciones | Muestra `correction.text` si existe, sino `chapter.content` por párrafo |
| WB-011 | Tooltip de corrección | Al hacer hover en párrafo corregido, muestra quién lo corrigió |
| WB-012 | Panel de sugerencias | Clic en párrafo abre panel lateral con sugerencias activas |
| WB-013 | Crear sugerencia | Usuario registrado puede proponer texto alternativo para un párrafo |
| WB-014 | Votar sugerencia | Like/unlike en sugerencias de otros usuarios |
| WB-015 | Navegación fluida | Botones prev/next capítulo, shortcut teclado |
| WB-016 | Modo lectura | Tipografía optimizada, control de tamaño de fuente, modo oscuro |

---

### 5.4 zenith-mobile

**Responsabilidad**: Lector mobile con enfoque en experiencia de lectura. Funcionalidad editorial en v2.

| ID | Funcionalidad | Versión |
|----|---------------|---------|
| MB-001 | Catálogo de novelas | v1 |
| MB-002 | Lector de capítulos con correcciones aplicadas | v1 |
| MB-003 | Navegación prev/next capítulo | v1 |
| MB-004 | Modo oscuro / configuración de tipografía | v1 |
| MB-005 | Guardado de progreso de lectura | v1 |
| MB-006 | Crear y votar sugerencias | v2 |
| MB-007 | Notificaciones push (nueva corrección aceptada, etc.) | v2 |

---

## 6. Soporte de Idiomas

### 6.1 Idiomas soportados de forma nativa

Zenith soporta **inglés (en) y español (es)** como idiomas de primera clase. Esto aplica a dos dimensiones independientes:

| Dimensión | Descripción |
|-----------|-------------|
| **Idioma de la UI** | La interfaz (menús, botones, mensajes) está disponible en inglés y español |
| **Idioma del contenido** | Las novelas pueden estar en inglés o español. Se etiqueta explícitamente en el modelo de datos |

### 6.2 Otros idiomas

Para idiomas distintos del inglés y el español, Zenith **no bloquea ni interfiere** con herramientas externas de traducción. Los usuarios pueden usar el traductor del navegador (Google Translate, DeepL, etc.) o cualquier extensión similar.

> Zenith no gestionará traducciones automáticas ni soportará otros idiomas en la UI en el futuro previsible.

### 6.3 Impacto en el modelo de datos

El campo `language` se agrega a `Novel` y `Chapter`:

```prisma
model Novel {
  // ...
  language    String   @default("en")   // "en" | "es"
}

model Chapter {
  // ...
  language    String   @default("en")   // puede diferir de la novela si hay traducción parcial
}
```

### 6.4 Impacto en el sistema editorial

Las sugerencias y correcciones están **atadas al idioma del contenido**. Un capítulo en español solo acepta sugerencias en español. Esto se valida a nivel de API.

### 6.5 Impacto en la UI

- El usuario puede filtrar el catálogo por idioma (`/novels?lang=es`)
- La UI detecta el idioma preferido del navegador y hace fallback a inglés si no es español
- El selector de idioma de la UI está disponible en el header en todo momento

---

## 7. Base de Datos — Modelo de Dominio

### 6.1 Dominios

La base de datos está organizada en tres dominios lógicos:

```
CONTENIDO RAW (scraper)     EDITORIAL (comunidad)      USUARIOS (auth)
─────────────────────────   ───────────────────────    ─────────────────
Author                      Suggestion                 User
Genre                         - paragraphIndex           - username
Novel                         - text                     - email
Chapter                       - status                   - role
  - content (raw, inmutable)  - voteCount              Vote
                              - appliedAt                - userId
                            Correction                   - suggestionId
                              - paragraphIndex
                              - original (snapshot)
                              - correctedText
```

### 6.2 Schema Prisma completo

```prisma
// ─────────────────────────────────────────
// DOMINIO: CONTENIDO RAW
// Propiedad exclusiva del scraper
// ─────────────────────────────────────────

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
  id          Int        @id @default(autoincrement())
  title       String
  slug        String     @unique
  url         String     @unique
  description String?    @db.Text
  coverUrl    String?
  status      String?
  language    String     @default("en")   // "en" | "es"
  authorId    Int?
  author      Author?    @relation(fields: [authorId], references: [id])
  genres      Genre[]
  chapters    Chapter[]
  reads       Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

model Chapter {
  id           Int          @id @default(autoincrement())
  title        String
  url          String       @unique
  content      String?      @db.LongText   // RAW — nunca modificar desde la API
  orderIndex   Int
  language     String       @default("en")   // "en" | "es"
  novelId      Int
  novel        Novel        @relation(fields: [novelId], references: [id], onDelete: Cascade)
  reads        Int          @default(0)
  suggestions  Suggestion[]
  corrections  Correction[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([novelId])
  @@index([url])
  @@unique([novelId, orderIndex])
}

// ─────────────────────────────────────────
// DOMINIO: USUARIOS
// ─────────────────────────────────────────

model User {
  id                Int          @id @default(autoincrement())
  username          String       @unique
  email             String       @unique
  passwordHash      String
  role              UserRole     @default(READER)
  suggestionsCount  Int          @default(0)   // total sugerencias creadas
  acceptedCount     Int          @default(0)   // sugerencias aceptadas (para ranking)
  suggestions       Suggestion[]
  votes             Vote[]
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
}

enum UserRole {
  READER
  EDITOR        // badge automático por acceptedCount >= threshold
  ADMIN
}

// ─────────────────────────────────────────
// DOMINIO: EDITORIAL
// ─────────────────────────────────────────

model Suggestion {
  id             Int              @id @default(autoincrement())
  chapterId      Int
  chapter        Chapter          @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  userId         Int
  user           User             @relation(fields: [userId], references: [id])
  paragraphIndex Int              // índice del párrafo dentro del capítulo
  originalText   String           @db.Text   // snapshot del texto en el momento de la sugerencia
  suggestedText  String           @db.Text   // texto propuesto por el usuario
  note           String?          // comentario opcional del usuario
  status         SuggestionStatus @default(PENDING)
  voteCount      Int              @default(0)
  votes          Vote[]
  appliedAt      DateTime?
  correction     Correction?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([chapterId, paragraphIndex])
  @@index([userId])
  @@index([status])
}

enum SuggestionStatus {
  PENDING      // esperando votos
  APPLIED      // aceptada y aplicada como corrección activa
  SUPERSEDED   // fue aplicada pero una sugerencia mejor la reemplazó
  REJECTED     // rechazada por admin
}

model Vote {
  id           Int        @id @default(autoincrement())
  suggestionId Int
  suggestion   Suggestion @relation(fields: [suggestionId], references: [id], onDelete: Cascade)
  userId       Int
  user         User       @relation(fields: [userId], references: [id])
  createdAt    DateTime   @default(now())

  @@unique([suggestionId, userId])   // un voto por usuario por sugerencia
}

model Correction {
  id             Int        @id @default(autoincrement())
  chapterId      Int
  chapter        Chapter    @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  suggestionId   Int        @unique
  suggestion     Suggestion @relation(fields: [suggestionId], references: [id])
  paragraphIndex Int
  originalText   String     @db.Text
  correctedText  String     @db.Text
  appliedAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@unique([chapterId, paragraphIndex])   // una corrección activa por párrafo
  @@index([chapterId])
}
```

---

## 7. Sistema Editorial Comunitario

Este es el diferenciador central de Zenith. Se describe aquí en detalle.

### 7.1 Ciclo de vida de una sugerencia

```
Usuario propone texto alternativo para párrafo N
            │
            ▼
    Suggestion { status: PENDING, voteCount: 0 }
            │
            ▼
    Otros usuarios votan (LIKE)
            │
            ├─── voteCount < threshold ──▶ sigue PENDING
            │
            └─── voteCount >= threshold
                        │
                        ▼
              ¿Existe corrección activa para ese párrafo?
                        │
              ┌─────────┴──────────┐
             NO                   SÍ
              │                    │
              ▼                    ▼
       Crear Correction    ¿Nueva tiene más votos?
       status → APPLIED         │
                           ┌────┴────┐
                          NO        SÍ
                           │         │
                           ▼         ▼
                      sin cambio  Reemplazar corrección
                                  vieja → SUPERSEDED
                                  nueva → APPLIED
```

### 7.2 Cálculo del threshold

```
threshold = max(MIN_VOTES, floor(chapter.reads * VOTE_RATIO))

donde:
  MIN_VOTES  = 10   (configurable por admin)
  VOTE_RATIO = 0.02 (2% de lectores del capítulo)
```

Un capítulo con 100 lecturas necesita 10 votos (mínimo).  
Un capítulo con 1000 lecturas necesita 20 votos.  
Un capítulo con 5000 lecturas necesita 100 votos.

### 7.3 Renderizado en el lector

```
Para cada párrafo i del capítulo:
  correction = Corrections WHERE chapterId = X AND paragraphIndex = i
  
  mostrar:
    SI correction existe → correction.correctedText  (con indicador visual)
    SI NO               → párrafo original de chapter.content
```

### 7.4 Incentivos y gamificación

| Acción | Recompensa |
|--------|-----------|
| Sugerencia aceptada | +1 `user.acceptedCount` |
| `acceptedCount >= 10` | Badge "Editor" (rol EDITOR) |
| `acceptedCount >= 50` | Badge "Editor Senior" (visual) |
| Párrafo corregido | Nombre del usuario visible en tooltip |
| Top editores por novela | Aparecen en la página de la novela |

---

## 8. Roadmap por Fases

### Fase 0 — Fundación (actual)
- [x] zenith-scrapper funcional con DDD, Prisma, 110 tests
- [x] Git inicializado
- [ ] Schema Prisma completo (dominios editorial + usuarios)
- [ ] zenith-api bootstrapped con Hono.js + Bun

### Fase 1 — Leer (MVP de lectura)
**Goal**: Un usuario puede navegar el catálogo y leer capítulos en la web.

- [ ] API: endpoints de catálogo (novelas, capítulos)
- [ ] Web: home, catálogo, detalle de novela, lector básico
- [ ] Web: modo oscuro, tipografía configurable
- [ ] Web: navegación prev/next capítulo

### Fase 2 — Contribuir (MVP editorial)
**Goal**: Un usuario registrado puede sugerir y votar correcciones.

- [ ] API: auth (registro, login, JWT)
- [ ] API: endpoints de sugerencias y votos
- [ ] API: job de promoción automática (threshold check)
- [ ] Web: panel de sugerencias en el lector
- [ ] Web: crear sugerencia por párrafo
- [ ] Web: votar sugerencias
- [ ] Web: renderizado con correcciones aplicadas

### Fase 3 — Comunidad
**Goal**: Los usuarios tienen identidad y visibilidad.

- [ ] Web: perfiles de usuario públicos
- [ ] Web: badges y ranking de editores por novela
- [ ] Web: historial de contribuciones
- [ ] API: estadísticas editoriales por novela

### Fase 4 — Mobile (v1)
**Goal**: Leer en mobile con correcciones aplicadas.

- [ ] zenith-mobile: catálogo y lector
- [ ] zenith-mobile: modo oscuro, tipografía
- [ ] zenith-mobile: progreso de lectura guardado

### Fase 5 — Mobile editorial (v2)
- [ ] zenith-mobile: sugerir y votar desde mobile
- [ ] zenith-mobile: notificaciones push

---

## 9. Stack Tecnológico

| Capa | Tecnología | Versión | Notas |
|------|------------|---------|-------|
| **Scraper runtime** | Python | 3.10+ | Ya implementado |
| **Scraper browser** | Playwright | latest | Ya implementado |
| **Scraper ORM** | Prisma Client Python | latest | Ya implementado |
| **API runtime** | Bun | latest | Preferencia explícita del equipo |
| **API framework** | Hono.js | latest | Nativo para Bun, type-safe |
| **API ORM** | Prisma Client TS | latest | Mismo schema, cliente TS |
| **Web framework** | Angular | 19 | Standalone components, signals, SSR via Angular Universal |
| **Web runtime** | Bun | latest | `bun install`, `bun run` |
| **Auth** | Better Auth | latest | Auth lista, compatible con Hono + Angular |
| **Mobile** | Expo (React Native) | latest | Cross-platform iOS/Android |
| **Base de datos** | MariaDB | 10.6+ | Un solo schema Prisma compartido |
| **Estilos web** | Tailwind CSS | v4 | Utility-first |
| **Gestor de paquetes** | Bun workspaces | — | Para zenith-api y zenith-web |

### Estructura del monorepo

El proyecto es un **monolito gestionado con Bun workspaces** para `zenith-api` y `zenith-web`. El scrapper Python vive como subproyecto independiente (no puede integrarse en Bun workspaces por ser un runtime distinto).

```
zenith/
├── PRD.md                    ← este documento
├── AGENTS.md                 ← instrucciones globales para agentes de IA
├── package.json              ← raíz del Bun workspace (workspaces: ["zenith-api", "zenith-web"])
├── zenith-scrapper/          ← Python, ya existe (subproyecto independiente)
│   ├── AGENTS.md             ← instrucciones específicas para el scrapper
│   ├── prisma/schema.prisma  ← source of truth del schema
│   └── ...
├── zenith-api/               ← Hono.js + Bun (workspace)
│   ├── AGENTS.md             ← instrucciones específicas para la API
│   └── ...
└── zenith-web/               ← Angular 19 + Bun (workspace)
    ├── AGENTS.md             ← instrucciones específicas para la web
    └── ...
```

**Nota sobre AGENTS.md**: Cada subproyecto tiene su propio `AGENTS.md` con instrucciones específicas para agentes de IA (convenciones, comandos disponibles, arquitectura interna, qué NO tocar). El `AGENTS.md` raíz contiene el contexto global del proyecto.

**Nota sobre Bun workspaces**: El `package.json` raíz declara `zenith-api` y `zenith-web` como workspaces. El scrapper Python no participa del workspace pero comparte el schema Prisma.

**Nota sobre Prisma schema**: El `schema.prisma` vive en `zenith-scrapper/prisma/` como source of truth. `zenith-api` referencia el mismo schema (symlink o script de copia en CI). En el futuro se puede extraer a un paquete compartido.

---

## 10. Criterios de Éxito

### Fase 1
- [ ] Usuario puede navegar el catálogo y leer capítulos
- [ ] Tiempo de carga de capítulo < 1s (SSR via Angular Universal)
- [ ] API responde en < 200ms p95

### Fase 2
- [ ] Usuario puede registrarse, sugerir y votar
- [ ] Corrección se aplica automáticamente al alcanzar threshold
- [ ] Un usuario no puede votar su propia sugerencia
- [ ] Un usuario no puede votar dos veces la misma sugerencia

### Fase 3
- [ ] Perfiles públicos muestran contribuciones reales
- [ ] Badges se asignan automáticamente por acceptedCount

### Calidad general
- [ ] API con cobertura de tests > 80%
- [ ] Web con tests E2E para flujos críticos (login, sugerir, votar)
- [ ] Schema Prisma con migraciones versionadas
- [ ] CI/CD básico (lint + tests en cada PR)

### Soporte de idiomas
- [ ] UI disponible en inglés y español
- [ ] Catálogo filtrable por idioma del contenido (`?lang=en` / `?lang=es`)
- [ ] API valida que sugerencias respeten el idioma del capítulo
- [ ] UI detecta idioma del navegador y hace fallback a inglés
