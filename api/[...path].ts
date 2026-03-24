// Catch-all proxy (may not match all nested paths on Vercel — see explicit routes under api/user/auth/, api/auth/).
import proxyToBackend from '../lib/vercelBackendProxy.js';
export default proxyToBackend;
