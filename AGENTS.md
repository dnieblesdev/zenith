# AGENTS.md — Zenith (raíz)

Contexto global del proyecto para agentes de IA. Leé esto primero antes de operar en cualquier subproyecto.

---

## Qué es Zenith

Plataforma de lectura de novelas web con sistema editorial comunitario. Los lectores sugieren correcciones a párrafos, votan las mejores, y estas se aplican automáticamente al alcanzar un umbral de votos.

Contenido nativo en inglés y español. Los lectores son los editores.

---

## Estructura del monorepo

```
zenith/
├── AGENTS.md                 ← este archivo
├── package.json              ← raíz Bun workspace
├── zenith-scrapper/          ← Python (subproyecto independiente)
│   ├── AGENTS.md
│   └── prisma/schema.prisma  ← source of truth del schema Prisma
├── zenith-api/               ← Hono.js + Bun (workspace)
│   └── AGENTS.md
└── zenith-web/               ← Angular 19 + Bun (workspace)
    └── AGENTS.md
```

El workspace Bun gestiona `zenith-api` y `zenith-web`. El scrapper Python es independiente.

---

## Stack global

| Capa              | Tecnología            | Notas                                      |
|-------------------|-----------------------|--------------------------------------------|
| Scraper           | Python 3.10+          | Playwright, Prisma Python                  |
| API               | Hono.js + Bun         | TypeScript, Prisma TS                      |
| Web               | Angular 19 + Bun      | Standalone, Signals, SSR (Angular Universal) |
| Base de datos     | MariaDB 10.6+         | Schema compartido vía Prisma               |
| Auth              | Better Auth           | Compatible con Hono + Angular              |
| Estilos           | Tailwind CSS v4       | Utility-first                              |
| Gestor de paquetes| Bun workspaces        | Solo para api y web                        |

---

## Dominios del sistema

```
CONTENIDO RAW (scraper)     EDITORIAL (comunidad)      USUARIOS (auth)
─────────────────────────   ───────────────────────    ─────────────────
Author                      Suggestion                 User
Genre                       Correction                 Vote
Novel
Chapter
```

### Reglas de propiedad de datos — CRÍTICO

- `zenith-scrapper` **es el único que escribe** en: `Author`, `Genre`, `Novel`, `Chapter`
- `zenith-api` **NUNCA modifica** `chapter.content` — campo inmutable, propiedad exclusiva del scraper
- Las correcciones viven en `Suggestion` y `Correction`, se renderizan como capa encima del contenido raw
- Un agente que toque `chapter.content` desde la API está rompiendo una invariante central del sistema

---

## Schema Prisma — source of truth

El schema vive en `zenith-scrapper/prisma/schema.prisma`. Es la única fuente de verdad.

`zenith-api` lo referencia via symlink o copia en CI. No hay dos schemas.

Si necesitás hacer una migración: modificá el schema en `zenith-scrapper/prisma/schema.prisma`, luego generá el cliente en ambos proyectos.

---

## Idiomas soportados

Zenith soporta inglés (`en`) y español (`es`) como idiomas de primera clase:
- Las novelas y capítulos tienen campo `language`
- Las sugerencias deben respetar el idioma del capítulo (validado en la API)
- La UI detecta el idioma del navegador y hace fallback a inglés

---

## Sistema editorial — flujo central

1. Usuario propone texto alternativo para un párrafo → `Suggestion { status: PENDING }`
2. Otros usuarios votan → `voteCount` sube
3. Al alcanzar `threshold = max(10, floor(reads * 0.02))` → la sugerencia se aplica automáticamente
4. Se crea un registro `Correction` y la sugerencia pasa a `APPLIED`
5. Si otra sugerencia supera los votos de la corrección activa → la vieja pasa a `SUPERSEDED`

---

## Convenciones del proyecto

- **PRD.md** es la fuente de verdad del producto. Si hay ambigüedad, el PRD manda.
- Cada subproyecto tiene su propio `AGENTS.md` con instrucciones específicas. Leelo antes de operar en ese subproyecto.
- Los IDs de funcionalidades siguen el patrón `SC-XXX` (scraper), `AP-XXX` (api), `WB-XXX` (web), `MB-XXX` (mobile).

---

## Qué NO hacer (global)

- ❌ Modificar `chapter.content` desde `zenith-api`
- ❌ Crear un segundo schema Prisma — hay uno solo en `zenith-scrapper/prisma/`
- ❌ Agregar lógica de negocio al scrapper — solo scrapea y persiste
- ❌ Hacer llamadas directas a la DB desde `zenith-web` — todo va por la API REST
- ❌ Ignorar el campo `language` al crear sugerencias
