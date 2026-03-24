// Vercel catch-all: forwards /api/* to PROXY_TARGET (see lib/vercelBackendProxy.ts).
export { config, default, GET, POST, PUT, PATCH, DELETE, OPTIONS } from '../lib/vercelBackendProxy';
