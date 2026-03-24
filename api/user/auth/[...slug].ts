/**
 * Vercel: /api/user/auth/* (login, register, google/*, etc.).
 * Nested routes are not always covered by api/[...path].ts on all Vercel builds.
 */
export { config, default } from '../../../lib/vercelBackendProxy';
