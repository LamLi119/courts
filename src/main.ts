import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { createApp } from 'vue';
import { prefetchVenuesBootstrap } from './utils/venuesBootstrap';

const updateSW = registerSW({
  immediate: false,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    registration.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => {});
      }
    });
  },
});

function registerServiceWorkerDeferred(): void {
  const register = () => {
    updateSW();
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(register, { timeout: 4000 });
  } else {
    window.addEventListener('load', () => setTimeout(register, 2000), { once: true });
  }
}

async function bootstrap(): Promise<void> {
  // Load bootstrap JSON before App.vue so hydrateInitialVenueData() can use it.
  await prefetchVenuesBootstrap();

  const [{ default: App }, { installRouter }] = await Promise.all([
    import('./App.vue'),
    import('./router'),
  ]);

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Could not find root element to mount to');

  // Drop prerendered SEO static HTML before mount so users only see the Vue app.
  rootElement.replaceChildren();

  const app = createApp(App);
  installRouter(app);
  app.mount(rootElement);

  registerServiceWorkerDeferred();
}

bootstrap();
