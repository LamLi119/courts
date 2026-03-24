/**
 * Vercel: /api/auth/session, /api/auth/logout, etc.
 * api/auth/login.ts remains the explicit handler for POST /api/auth/login.
 */
export { config, default } from '../../lib/vercelBackendProxy';
