# Zenith

Plataforma de lectura de novelas web con sistema editorial comunitario. Los lectores proponen correcciones a párrafos, votan las mejores, y estas se aplican automáticamente al alcanzar un umbral de votos.

Contenido nativo en inglés y español. **Los lectores son los editores.**

---

## Stack

| Capa | Tecnología |
|------|------------|
| Scraper | Python 3.10+ (Playwright, Prisma Python) |
| API | Hono.js + Bun (TypeScript, Prisma) |
| Web | Angular 19 + Bun (Standalone, Signals, Zoneless, SSR) |
| Base de datos | MariaDB 10.6+ (Prisma ORM) |
| Auth | Better Auth |
| Estilos | Tailwind CSS v4 |
| Gestor de paquetes | Bun workspaces |

---

## Estructura del monorepo

```
zenith/
├── zenith-scrapper/     # Python — scrapea y persiste contenido
├── zenith-api/          # Hono.js + Bun — REST API
└── zenith-web/          # Angular 19 — Aplicación web
```

---

## Getting Started

### Requisitos

- Bun 1.0+
- Python 3.10+
- MariaDB 10.6+

### Instalación

```bash
# Instalar dependencias del workspace
bun install

# Generar clientes Prisma
cd zenith-scrapper && bun prisma generate
cd ../zenith-api && bun prisma generate

# Configurar variables de entorno
cp .env.example .env
```

### Desarrollo

```bash
# API
cd zenith-api
bun run dev

# Web
cd zenith-web
bun run dev
```

---

## Sistema editorial

1. Usuario propone texto alternativo para un párrafo → `Suggestion { status: PENDING }`
2. Otros usuarios votan → `voteCount` sube
3. Al alcanzar `threshold = max(10, floor(reads * 0.02))` → la sugerencia se aplica automáticamente
4. Se crea un registro `Correction` y la sugerencia pasa a `APPLIED`

---

## Licencia

MIT
