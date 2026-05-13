/**
 * Explicit route so Vercel always invokes the serverless proxy for GET /api/events/public
 * (upcoming events). The catch-all api/[...path].ts should match too, but a dedicated
 * file avoids any edge-case routing gaps for nested paths.
 */
import proxyToBackend from '../../lib/vercelBackendProxy.js';

export default proxyToBackend;
