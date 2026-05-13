import { createRouter, createWebHistory } from 'vue-router';
import type { App } from 'vue';
import { slugify } from '../utils/slugify';

export const routes = [
  { path: '/', name: 'home', meta: { title: 'Courts' } },
  { path: '/venues/:slug', name: 'venue', meta: { title: 'Venue' } },
  { path: '/search/:sport', name: 'search', meta: { title: 'Search' } },
  { path: '/admin', name: 'admin', meta: { title: 'Admin' } },
  { path: '/admin/manage', name: 'admin-manage', meta: { title: 'Admin Manage' } },
  { path: '/login', name: 'login', meta: { title: 'Login' } },
  { path: '/signup', name: 'signup', meta: { title: 'Sign Up' } },
  { path: '/token-login', name: 'token-login', meta: { title: 'Token Login' } },
  { path: '/complete-phone', name: 'complete-phone', meta: { title: 'Complete Phone' } },
  // Backend may redirect here with ?token= / ?refreshToken= (same as server extractOAuthTokens).
  {
    path: '/auth/google/callback',
    redirect: (to) => ({ path: '/token-login', query: to.query, hash: to.hash }),
  },
];

const router = createRouter({
  history: createWebHistory(typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/'),
  routes: routes as any,
});

export function useVenueSlug(venue: { name: string }): string {
  return slugify(venue.name);
}

export function installRouter(app: App): void {
  app.use(router);
}

export default router;
