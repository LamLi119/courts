import { onMounted, onUnmounted, ref } from 'vue';

/** Matches Tailwind `lg` — below 1024px is mobile layout. */
export const MOBILE_MEDIA_QUERY = '(max-width: 1023px)';

export function readIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  return viewportWidth < 1024;
}

export function useIsMobile() {
  const isMobile = ref(readIsMobile());
  let mq: MediaQueryList | null = null;

  const sync = () => {
    isMobile.value = readIsMobile();
  };

  onMounted(() => {
    mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    mq.addEventListener('change', sync);
    window.visualViewport?.addEventListener('resize', sync);
    window.addEventListener('resize', sync);
    sync();
  });

  onUnmounted(() => {
    mq?.removeEventListener('change', sync);
    window.visualViewport?.removeEventListener('resize', sync);
    window.removeEventListener('resize', sync);
  });

  return isMobile;
}
