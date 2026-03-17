// ---------------------------------------------------------------------------
// User domain models — mirrors the Prisma schema (zenith-scrapper/prisma/schema.prisma)
// ---------------------------------------------------------------------------

export type UserRole = 'READER' | 'EDITOR' | 'ADMIN';

/**
 * Authenticated user as stored in AuthService after a successful login.
 * `passwordHash` is never exposed to the client — the API omits it.
 */
export interface User {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

/**
 * Minimal user shape used in public contexts (suggestion author, etc.).
 */
export type UserSummary = Pick<User, 'id' | 'username' | 'role'>;
