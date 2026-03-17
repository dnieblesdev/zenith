import {
  ApplicationConfig,
  provideExperimentalZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';

import { routes } from './routes';
import { authInterceptor } from '../adapters/interceptors/auth';
import { ApiChapterRepository } from '../adapters/driven/api-chapter.repository';
import { ApiSuggestionRepository } from '../adapters/driven/api-suggestion.repository';
import { ApiNovelRepository } from '../adapters/driven/api-novel.repository';
import { CHAPTER_REPOSITORY } from '../domain/ports/chapter.repository';
import { SUGGESTION_REPOSITORY } from '../domain/ports/suggestion.repository';
import { NOVEL_REPOSITORY } from '../domain/ports/novel.repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    { provide: CHAPTER_REPOSITORY, useClass: ApiChapterRepository },
    { provide: SUGGESTION_REPOSITORY, useClass: ApiSuggestionRepository },
    { provide: NOVEL_REPOSITORY, useClass: ApiNovelRepository },
  ],
};
