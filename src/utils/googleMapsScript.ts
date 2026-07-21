/**
 * Injects the Maps JavaScript API (with places). Idempotent.
 * Dispatches the same window events as MapView: `google-maps-ready`, `google-maps-auth-error`.
 */
export function loadGoogleMapsScript(): void {
  if (typeof window === 'undefined') return;
  const logError = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.error(...args);
  };
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
  if (!apiKey) {
    logError('VITE_GOOGLE_MAPS_API_KEY is not defined in .env');
    window.dispatchEvent(new Event('google-maps-auth-error'));
    return;
  }
  if (document.querySelector('script[src*="maps.googleapis.com"]')) return;

  (window as unknown as { __onGoogleMapsLoaded?: () => void }).__onGoogleMapsLoaded = () => {
    window.dispatchEvent(new Event('google-maps-ready'));
  };
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=__onGoogleMapsLoaded`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    logError('Failed to load Google Maps API');
    window.dispatchEvent(new Event('google-maps-auth-error'));
  };
  document.head.appendChild(script);
}
