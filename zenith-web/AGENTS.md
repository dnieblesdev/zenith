# AGENTS.md — zenith-web

Instrucciones específicas para operar en `zenith-web`. Leé el `AGENTS.md` raíz primero para el contexto global.

---

## Qué hace este subproyecto

Interfaz web principal de Zenith. Lectura de novelas, sistema editorial (sugerencias + votos), perfiles de usuario y panel admin.

---

## Stack

| Herramienta | Uso |
|-------------|-----|
| Angular 21 | Framework — standalone components, signals, zoneless |
| Angular Universal | SSR para SEO y carga inicial rápida |
| Angular Router | Enrutamiento con lazy loading por feature |
| Bun | Runtime y gestor de paquetes |
| Tailwind CSS v4 | Estilos utility-first |
| Better Auth | Autenticación con la API |
| TypeScript | Lenguaje |
| Playwright | Tests E2E |

---

## Estructura del proyecto

```
zenith-web/
├── package.json
├── angular.json
├── tsconfig.json
├── src/
│   ├── main.ts                    ← Bootstrap (zoneless)
│   ├── app/
│   │   ├── app.ts                 ← Root component
│   │   ├── app.config.ts          ← Providers globales
│   │   ├── routes.ts              ← Rutas de la aplicación
│   │   ├── features/
│   │   │   ├── home/
│   │   │   │   └── home.ts        ← WB-001
│   │   │   ├── catalog/
│   │   │   │   ├── catalog.ts     ← WB-002
│   │   │   │   └── components/
│   │   │   ├── novel/
│   │   │   │   ├── novel.ts       ← WB-003
│   │   │   │   └── components/
│   │   │   ├── reader/
│   │   │   │   ├── reader.ts      ← WB-004 (lector de capítulo)
│   │   │   │   └── components/
│   │   │   │       ├── paragraph.ts
│   │   │   │       └── suggestion-panel.ts
│   │   │   ├── profile/
│   │   │   │   └── profile.ts     ← WB-005
│   │   │   ├── auth/
│   │   │   │   ├── login.ts       ← WB-006
│   │   │   │   └── register.ts    ← WB-006
│   │   │   ├── admin/
│   │   │   │   └── admin.ts       ← WB-007
│   │   │   └── shared/            ← Componentes usados por 2+ features
│   │   │       └── components/
│   │   │           ├── navbar.ts
│   │   │           └── language-selector.ts
│   │   └── core/
│   │       ├── services/
│   │       │   ├── api.ts         ← HTTP client hacia zenith-api
│   │       │   └── auth.ts        ← Estado de auth global
│   │       ├── guards/
│   │       │   └── auth.ts        ← Protección de rutas
│   │       └── interceptors/
│   │           └── auth.ts        ← Inyecta JWT en requests
└── e2e/
    └── tests/                     ← Playwright E2E
```

---

## Comandos

```bash
# Instalar dependencias (desde raíz del workspace)
bun install

# Dev server
bun run start

# Build de producción (con SSR)
bun run build

# Tests unitarios
bun run test

# Tests E2E (Playwright)
bun run e2e

# Type checking
bunx tsc --noEmit
```

---

## Convenciones Angular — OBLIGATORIAS

### Componentes standalone (no poner `standalone: true`)

```typescript
// Angular 21: standalone ES EL DEFAULT — no declarar la propiedad
@Component({
  selector: 'app-reader',
  imports: [NgIf, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `...`
})
export class ReaderComponent {}
```

### Signals para estado — siempre, no RxJS para estado simple

```typescript
readonly chapters = signal<Chapter[]>([])
readonly loading = signal(false)
readonly currentChapter = computed(() => this.chapters()[this.index()])
```

### inject() — nunca constructor injection

```typescript
// ✅
private readonly apiService = inject(ApiService)

// ❌
constructor(private apiService: ApiService) {}
```

### Input/Output con functions — nunca decoradores

```typescript
// ✅
readonly novel = input.required<Novel>()
readonly chapterSelected = output<Chapter>()

// ❌
@Input() novel: Novel
@Output() chapterSelected = new EventEmitter<Chapter>()
```

### Control flow nativo — nunca `*ngIf`, `*ngFor`

```html
@if (loading()) {
  <app-spinner />
} @else {
  @for (chapter of chapters(); track chapter.id) {
    <app-chapter-item [chapter]="chapter" />
  } @empty {
    <p>No hay capítulos</p>
  }
}
```

### Zoneless — REQUERIDO

```typescript
// app.config.ts
import { provideZonelessChangeDetection } from '@angular/core'

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // ...
  ]
}
```

No usar Zone.js. No tiene lifecycle hooks (`ngOnInit`, `ngOnDestroy`) — usar `effect()` y `DestroyRef`.

### Sin lifecycle hooks

```typescript
// ❌ NUNCA
ngOnInit() { this.load() }

// ✅ SIEMPRE
private readonly id = input.required<string>()
constructor() {
  effect(() => this.load(this.id()))
}
```

### File naming — sin sufijos `.component`, `.service`

```
✅ reader.ts          (componente del lector)
✅ api.ts             (servicio de API)
✅ novel.ts           (tipo/modelo)
❌ reader.component.ts
❌ api.service.ts
```

### Scope Rule — dónde vive cada componente

| Usado por | Ubicación |
|-----------|-----------|
| 1 sola feature | `features/[feature]/components/` |
| 2+ features | `features/shared/components/` |
| App-wide (guards, interceptors) | `core/` |

---

## Rutas de la aplicación

| ID | Ruta | Componente |
|----|------|-----------|
| WB-001 | `/` | `home/home.ts` |
| WB-002 | `/novels` | `catalog/catalog.ts` |
| WB-003 | `/novels/:slug` | `novel/novel.ts` |
| WB-004 | `/novels/:slug/:chapter` | `reader/reader.ts` |
| WB-005 | `/users/:username` | `profile/profile.ts` |
| WB-006 | `/login` `/register` | `auth/login.ts` `auth/register.ts` |
| WB-007 | `/admin` | `admin/admin.ts` |

Todas las rutas usan **lazy loading** (`loadComponent`).

---

## Comunicación con la API

Todas las llamadas van a `zenith-api` vía HTTP REST. Nunca llamadas directas a la DB.

```typescript
// core/services/api.ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient)
  private readonly base = '/api'  // proxy en dev, mismo origen en prod

  getNovels(params?: NovelQueryParams) {
    return this.http.get<NovelsResponse>(`${this.base}/novels`, { params })
  }
}
```

---

## Renderizado del lector (lógica central WB-010)

Para cada párrafo `i` de un capítulo:

```typescript
// Si existe una Correction para ese párrafo → mostrar correctedText con indicador visual
// Si no existe → mostrar el texto raw del párrafo original
getParagraphText(index: number): { text: string; isCorrected: boolean } {
  const correction = this.corrections().find(c => c.paragraphIndex === index)
  return correction
    ? { text: correction.correctedText, isCorrected: true }
    : { text: this.chapter().paragraphs[index], isCorrected: false }
}
```

---

## Soporte de idiomas (UI)

- Detectar idioma del navegador al iniciar → fallback a `en` si no es `es`
- Selector de idioma siempre visible en el navbar
- Catálogo filtrable por `?lang=en` o `?lang=es`

---

## Reglas críticas — NO romper

- ❌ **NO usar `*ngIf`, `*ngFor`, `*ngSwitch`** — usar control flow nativo (`@if`, `@for`, `@switch`)
- ❌ **NO usar `ngOnInit`** — usar `effect()` o señales computadas
- ❌ **NO usar constructor injection** — siempre `inject()`
- ❌ **NO llamar directamente a la DB** — todo va por `zenith-api`
- ❌ **NO usar Zone.js** — el proyecto es zoneless
- ✅ Usar `ChangeDetectionStrategy.OnPush` en todos los componentes
- ✅ Lazy loading en todas las rutas

---

## Variables de entorno

```env
API_URL=http://localhost:3000
```

En producción, `zenith-web` y `zenith-api` pueden servirse desde el mismo origen — la API está en `/api`.
