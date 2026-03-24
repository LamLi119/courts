// Vercel catch-all: forwards /api/* to PROXY_TARGET (see lib/vercelBackendProxy.ts).
export { config, default } from '../lib/vercelBackendProxy';
