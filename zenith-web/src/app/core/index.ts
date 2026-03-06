// ---------------------------------------------------------------------------
// Core barrel — re-exports all core services, guards, interceptors, and models.
// Import from '@app/core' to keep feature module imports stable.
// ---------------------------------------------------------------------------

// Services
export { ApiService } from './services/api';
export { AuthService } from './services/auth';
export type { AuthUser } from './services/auth';

// Guards
export { authGuard } from './guards/auth';

// Interceptors
export { authInterceptor } from './interceptors/auth';

// Models — Novel domain
export type {
  Author,
  Genre,
  Novel,
  NovelSummary,
  NovelQueryParams,
  PaginatedResponse,
} from './models/novel.model';

// Models — Chapter domain
export type { Chapter, ChapterDetail } from './models/chapter.model';

// Models — User domain
export type { User, UserSummary, UserRole } from './models/user.model';

// Models — Editorial domain
export type {
  Suggestion,
  SuggestionStatus,
  Vote,
  Correction,
} from './models/suggestion.model';
