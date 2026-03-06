# AGENTS.md — zenith-api

Instrucciones específicas para operar en `zenith-api`. Leé el `AGENTS.md` raíz primero para el contexto global.

---

## Qué hace este subproyecto

API REST que expone el contenido de la DB y gestiona toda la lógica editorial y de usuarios. Construida con Hono.js sobre Bun runtime.

---

## Stack

| Herramienta | Uso |
|-------------|-----|
| Bun | Runtime y gestor de paquetes |
| Hono.js | Framework HTTP type-safe |
| Prisma Client TS | ORM — usa el schema de `zenith-scrapper/prisma/` |
| Better Auth | Autenticación (JWT, sesiones) |
| TypeScript | Lenguaje |
| Vitest | Testing |

---

## Estructura del proyecto

```
zenith-api/
├── package.json
├── tsconfig.json
├── prisma/
│   └── schema.prisma          ← Copia de zenith-scrapper/prisma/schema.prisma (ver nota abajo)
├── src/
│   ├── index.ts               ← Entry point — instancia Hono y monta rutas
│   ├── routes/
│   │   ├── novels.ts          ← AP-001..004
│   │   ├── chapters.ts        ← AP-004
│   │   ├── auth.ts            ← AP-010..013
│   │   ├── suggestions.ts     ← AP-020..024
│   │   └── admin.ts           ← AP-030..034
│   ├── services/
│   │   ├── catalog.ts         ← Lógica de novelas y capítulos
│   │   ├── editorial.ts       ← Lógica de sugerencias, votos, threshold
│   │   └── users.ts           ← Perfiles, badges
│   ├── middleware/
│   │   ├── auth.ts            ← Guard JWT / Better Auth
│   │   └── admin.ts           ← Guard rol ADMIN
│   ├── lib/
│   │   ├── db.ts              ← Instancia Prisma Client singleton
│   │   └── errors.ts          ← Helpers de errores HTTP
│   └── types/
│       └── index.ts           ← Tipos compartidos
└── tests/
    ├── catalog.test.ts
    ├── editorial.test.ts
    └── auth.test.ts
```

---

## Comandos

```bash
# Instalar dependencias (desde raíz del workspace)
bun install

# Dev con hot reload
bun run dev

# Build
bun run build

# Tests
bun run test

# Tests con coverage
bun run test --coverage

# Generar Prisma Client TS (después de cambiar schema)
bunx prisma generate --schema=prisma/schema.prisma

# Type checking
bunx tsc --noEmit
```

> **Nota sobre `prisma/schema.prisma`**: es una **copia** de `zenith-scrapper/prisma/schema.prisma` (source of truth).
> En Linux/macOS se puede usar un symlink: `ln -s ../zenith-scrapper/prisma/schema.prisma prisma/schema.prisma`
> En Windows, `mklink` requiere Developer Mode o permisos de admin — usar copia directa como fallback.
> Cada vez que el schema cambie en `zenith-scrapper`, hay que re-copiar y regenerar el cliente TS:
> ```bash
> cp ../zenith-scrapper/prisma/schema.prisma prisma/schema.prisma
> bunx prisma generate --schema=prisma/schema.prisma
> ```

---

## Convenciones de código

### Módulos y exports

```typescript
// Named exports siempre, no default exports
export const novelsRouter = new Hono()
export type NovelsResponse = { ... }
```

### Rutas Hono

```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../lib/db'

const novels = new Hono()

novels.get('/', zValidator('query', z.object({
  page: z.coerce.number().default(1),
  lang: z.enum(['en', 'es']).optional(),
})), async (c) => {
  const { page, lang } = c.req.valid('query')
  // ...
  return c.json({ data, total, page })
})

export { novels }
```

### Acceso a DB (Prisma)

```typescript
// lib/db.ts — singleton
import { PrismaClient } from '@prisma/client'
export const db = new PrismaClient()

// En servicios/rutas
import { db } from '../lib/db'
const novel = await db.novel.findUniqueOrThrow({ where: { id } })
```

### Errores HTTP

```typescript
import { HTTPException } from 'hono/http-exception'

// 404
throw new HTTPException(404, { message: 'Novel not found' })

// 403
throw new HTTPException(403, { message: 'Forbidden' })
```

### Naming

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Archivos de rutas | kebab-case | `novels.ts`, `suggestions.ts` |
| Variables/funciones | camelCase | `getNovelById` |
| Tipos/interfaces | PascalCase | `NovelResponse` |
| Constantes | UPPER_SNAKE_CASE | `MIN_VOTES` |

---

## Sistema editorial — lógica de threshold

El threshold para aplicar una sugerencia automáticamente:

```typescript
const MIN_VOTES = 10  // configurable por admin
const VOTE_RATIO = 0.02

function calculateThreshold(chapterReads: number): number {
  return Math.max(MIN_VOTES, Math.floor(chapterReads * VOTE_RATIO))
}
```

Este cálculo debe ejecutarse cada vez que se registra un voto nuevo. Si `suggestion.voteCount >= threshold`, la sugerencia pasa a `APPLIED` y se crea o reemplaza un `Correction`.

---

## Reglas críticas — NO romper

- ❌ **NUNCA modificar `chapter.content`** — campo inmutable, propiedad exclusiva del scrapper
- ❌ **NUNCA escribir en `Author`, `Genre`, `Novel`, `Chapter`** — propiedad del scrapper
- ❌ **NUNCA tener un schema Prisma propio** — referenciar el de `zenith-scrapper/prisma/`
- ✅ Las correcciones de la comunidad van en `Suggestion` y `Correction` únicamente
- ✅ Validar que las sugerencias respeten el `language` del capítulo

---

## Auth — Better Auth

- JWT para sesiones stateless
- Guard `middleware/auth.ts` protege todas las rutas que requieren usuario autenticado
- Guard `middleware/admin.ts` verifica `user.role === 'ADMIN'`
- Un usuario no puede votar su propia sugerencia (validar en `POST /suggestions/:id/vote`)

---

## Variables de entorno

```env
DATABASE_URL="mysql://user:password@localhost:3306/zenith"
BETTER_AUTH_SECRET="..."
PORT=3000
```

---

## IDs de funcionalidades (referencia rápida)

| ID | Endpoint |
|----|----------|
| AP-001 | `GET /novels` |
| AP-002 | `GET /novels/:id` |
| AP-003 | `GET /novels/:id/chapters` |
| AP-004 | `GET /chapters/:id` |
| AP-010 | `POST /auth/register` |
| AP-011 | `POST /auth/login` |
| AP-012 | `POST /auth/logout` |
| AP-013 | `GET /users/:id/profile` |
| AP-020 | `POST /chapters/:id/suggestions` |
| AP-021 | `GET /chapters/:id/suggestions` |
| AP-022 | `POST /suggestions/:id/vote` |
| AP-023 | `DELETE /suggestions/:id/vote` |
| AP-024 | `GET /suggestions/:id` |
| AP-030 | `POST /admin/novels` |
| AP-031 | `PUT /admin/novels/:id` |
| AP-032 | `POST /admin/novels/:id/sync` |
| AP-033 | `PUT /admin/suggestions/:id/status` |
| AP-034 | `GET /admin/stats` |
