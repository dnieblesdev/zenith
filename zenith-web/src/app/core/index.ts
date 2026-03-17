// ---------------------------------------------------------------------------
// Core barrel — re-exports all core services, guards, interceptors, and models.
// Import from '@app/core' to keep feature module imports stable.
// ---------------------------------------------------------------------------

// Services
export { AuthService } from './services/auth';
export type { AuthUser } from './services/auth';

// Guards
export { authGuard } from '../../adapters/guards/auth';

// Interceptors
export { authInterceptor } from '../../adapters/interceptors/auth';

// Models — Novel domain
export type {
  Author,
  Genre,
  Novel,
  NovelSummary,
  NovelQueryParams,
  PaginatedResponse,
} from '../../domain/models/novel.model';

// Models — Chapter domain
export type { Chapter, ChapterDetail, Paragraph } from '../../domain/models/chapter.model';

// Models — User domain
export type { User, UserSummary, UserRole } from '../../domain/models/user.model';

// Models — Editorial domain
export type {
  Suggestion,
  SuggestionStatus,
  Vote,
  Correction,
} from '../../domain/models/suggestion.model';
