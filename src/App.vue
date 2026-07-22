<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Venue, Language, AppTab } from '../types';
import { translate } from './utils/translations';
import { getStationCanonicalEn } from './utils/mtrStations';
import { venueMatchesDistricts, isValidDistrictSlug } from './utils/hkDistricts';
import { slugify } from './utils/slugify';
import { resetSeoToDefault, applySearchPageSeo, applyDistrictSportPageSeo, applyLandingPageSeo, applyExplorePageSeo, applyBlogListSeo, applyBlogPostSeo } from './utils/seo';
import { useVenueSlug } from './router';
import { db } from '../db';
import Header from './components/layout/Header.vue';
import MobileNav from './components/layout/MobileNav.vue';
import LandingPage from './components/landing/LandingPage.vue';
import AboutPage from './components/about/AboutPage.vue';
import BlogListPage from './components/blog/BlogListPage.vue';
import BlogPostPage from './components/blog/BlogPostPage.vue';
import { useAuth } from './composables/auth';
import { useIsMobile } from './composables/useIsMobile';
import { useGrindUpcomingEvents } from './composables/useGrindUpcomingEvents';
import {
  hydrateInitialVenueData,
  setVenuesCache,
  isVenuesCacheFresh,
  readSessionCacheMeta,
} from './utils/venuesBootstrap';
import { courtApiUrl } from './utils/courtApiUrl';

const AdminLogin = defineAsyncComponent(() => import('./components/auth/AdminLogin.vue'));
const UserLoginPage = defineAsyncComponent(() => import('./components/auth/UserLoginPage.vue'));
const UserSignUpPage = defineAsyncComponent(() => import('./components/auth/UserSignUpPage.vue'));
const TokenLoginPage = defineAsyncComponent(() => import('./components/auth/TokenLoginPage.vue'));
const CompletePhonePage = defineAsyncComponent(() => import('./components/auth/CompletePhonePage.vue'));
const DesktopView = defineAsyncComponent(() => import('./components/explore/DesktopView.vue'));
const MobileView = defineAsyncComponent(() => import('./components/explore/MobileView.vue'));
const VenueDetail = defineAsyncComponent(() => import('./components/venue/VenueDetail.vue'));
const UpcomingEventsPage = defineAsyncComponent(() => import('./components/venue/UpcomingEventsPage.vue'));
const VenueForm = defineAsyncComponent(() => import('./components/admin/VenueForm.vue'));
const AdminPage = defineAsyncComponent(() => import('./components/admin/AdminPage.vue'));
const AboutPage = defineAsyncComponent(() => import('./components/about/AboutPage.vue'));

const initialVenueData = hydrateInitialVenueData();
/** True after a successful /api/venues fetch this page load. Bootstrap alone must not skip the API. */
let venuesFetchedFromApi = false;

const route = useRoute();
const { refresh: refreshGrindUpcomingEvents } = useGrindUpcomingEvents();

const HOME_GRIND_POLL_MS = 120_000;
let grindUpcomingPollTimer: ReturnType<typeof setInterval> | null = null;
const router = useRouter();

const { user: authUser, logout: userLogout, session: restoreSession, isAuthenticated } = useAuth();
const showLogout = computed(() => !!authUser.value);

const handleUserLogout = async () => {
  await userLogout();
  // Keep the user on the current page (e.g. venue detail) after logout.
  // Only redirect away if we're already on an auth page.
  if (route.name === 'login' || route.name === 'signup' || route.name === 'token-login' || route.name === 'complete-phone') {
    router.replace('/');
  }
};

onMounted(() => {
  if (isAuthenticated.value) {
    restoreSession().catch(() => null);
  }
});

const language = ref<Language>('zh');
const currentTab = ref<AppTab>('explore');
const adminPassword = ref('');
const showAdminLogin = ref(false);
const isAdminLoggingIn = ref(false);
const showVenueForm = ref(false);
const editingVenue = ref<Venue | null>(null);
const venueToDelete = ref<Venue | null>(null);
const isLoading = ref(!initialVenueData.hasData);
const mobileViewMode = ref<'map' | 'list'>('list');

const venues = ref<Venue[]>(initialVenueData.venues);
const sports = ref<{ id: number; name: string; name_zh?: string | null; slug: string }[]>(initialVenueData.sports);
const savedVenues = ref<number[]>([]);

const sportDisplayName = (s: { name: string; name_zh?: string | null }) =>
  language.value === 'zh' && s.name_zh ? s.name_zh : s.name;

const selectedVenue = ref<Venue | null>(null);
const showDesktopDetail = ref(false);
const searchQuery = ref('');
const mtrFilter = ref<string[]>([]);
const districtFilter = ref<string[]>([]);
const distanceFilter = ref('');
const sportFilter = ref<string[]>([]); // sport slugs (multi-select)
const filterSpecialOffer = ref(false); // when true, only show venues with membership_enabled
const filterSavedOnly = ref(false); // explore tab: when true, only show saved venues
/** When set (after clicking a pin), list shows only venues at that location. */
const locationVenueIds = ref<number[] | null>(null);
const darkMode = ref(localStorage.getItem('pickleball_darkmode') === 'true');
const isMobile = useIsMobile();

const invalidateVenuesCache = () => {
  sessionStorage.removeItem('pickleball_venues_cache');
};

const adminStatus = ref<{ type: 'none' | 'super' | 'court'; allowedIds: number[] }>({ type: 'none', allowedIds: [] });
const superAdminSyncPassword = ref('');
const isSuperAdmin = computed(() => adminStatus.value.type === 'super');
const isAnyAdmin = computed(() => adminStatus.value.type !== 'none');

function canEditVenue(venueId: number): boolean {
  if (adminStatus.value.type === 'super') return true;
  if (adminStatus.value.type === 'court') return adminStatus.value.allowedIds.includes(venueId);
  return false;
}

const loadData = async (force = false) => {
  const hadData = venues.value.length > 0;
  const cacheMeta = readSessionCacheMeta();
  // Only skip when this session already fetched the API and the cache is still fresh.
  // Bootstrap/session hydrate must not block the first network refresh (stale mtrStation etc.).
  if (!force && venuesFetchedFromApi && hadData && cacheMeta && isVenuesCacheFresh(cacheMeta.ts)) {
    isLoading.value = false;
    return;
  }

  try {
    if (!hadData) {
      isLoading.value = true;
    }

    const [fresh, sportsList] = await Promise.all([db.getVenues(), db.getSports()]);
    if (fresh?.length !== undefined) {
      venues.value = fresh;
      setVenuesCache(fresh, sportsList || [], Date.now());
      venuesFetchedFromApi = true;
      // Re-bind after the venues watch/route state settle (bootstrap → API).
      await nextTick();
      syncSelectedVenueFromList();
    }
    if (sportsList?.length !== undefined) {
      sports.value = sportsList;
    }
  } catch (err) {
    if (!venues.value.length && import.meta.env.DEV) {
      console.error('Error fetching venues from DB:', err);
    }
  } finally {
    isLoading.value = false;
  }
};

const ADMIN_PATH = '/admin';

function isAdminPath(): boolean {
  return route.path === ADMIN_PATH || route.path.endsWith('/admin');
}

function syncAdminUrl(show: boolean) {
  if (show) router.push(ADMIN_PATH);
  else router.push('/');
}

function resolveVenueBySlug(slug: string): Venue | null {
  const s = (slug || '').toLowerCase().trim();
  if (!s) return null;
  return venues.value.find((v) => slugify(v.name) === s) ?? null;
}

/** Keep detail view on the current list object after venues are replaced (bootstrap → API). */
function syncSelectedVenueFromList() {
  if (route.name === 'venue' && typeof route.params.slug === 'string') {
    const slug = String(route.params.slug).toLowerCase().trim();
    const currentId = selectedVenue.value?.id;
    // Once we know the venue id, always rebind from the fresh list (bootstrap → API).
    // Do not require slug re-match — invisible chars in names previously broke this for id 8.
    if (currentId != null) {
      const byId = venues.value.find((v) => v.id === currentId);
      if (byId) {
        selectedVenue.value = byId;
        showDesktopDetail.value = true;
        return;
      }
    }
    const venue = resolveVenueBySlug(slug);
    if (venue) {
      selectedVenue.value = venue;
      showDesktopDetail.value = true;
    }
    return;
  }
  if (selectedVenue.value) {
    const fresh = venues.value.find((v) => v.id === selectedVenue.value!.id);
    if (fresh) selectedVenue.value = fresh;
  }
}

/** Always open the form with the latest list row (avoids empty MTR from a stale selectedVenue). */
function openVenueForm(venue: Venue | null) {
  if (!venue) {
    editingVenue.value = null;
    showVenueForm.value = true;
    return;
  }
  editingVenue.value = venues.value.find((v) => v.id === venue.id) ?? venue;
  showVenueForm.value = true;
}

watch(
  () => ({
    name: route.name,
    slug: route.params.slug,
    sport: route.params.sport,
    district: route.params.district,
  }),
  (params, prev) => {
    if (route.name === 'venue' && typeof route.params.slug === 'string') {
      const venue = resolveVenueBySlug(route.params.slug);
      selectedVenue.value = venue;
      showDesktopDetail.value = !!venue;
      if (!venue && venues.value.length > 0) router.replace('/');
    } else if (
      route.name === 'search-district'
      && typeof route.params.sport === 'string'
      && typeof route.params.district === 'string'
    ) {
      const district = route.params.district;
      if (!isValidDistrictSlug(district)) {
        router.replace(`/search/${route.params.sport}`);
        return;
      }
      sportFilter.value = [route.params.sport];
      districtFilter.value = [district];
      selectedVenue.value = null;
      showDesktopDetail.value = false;
      applyDistrictSportPageSeo(
        route.params.sport,
        district,
        venues.value,
        sports.value,
        language.value,
      );
    } else if (route.name === 'search' && typeof route.params.sport === 'string') {
      sportFilter.value = [route.params.sport];
      districtFilter.value = [];
      selectedVenue.value = null;
      showDesktopDetail.value = false;
      applySearchPageSeo(route.params.sport, venues.value, sports.value, language.value);
    } else if (route.name === 'explore') {
      selectedVenue.value = null;
      showDesktopDetail.value = false;
      if (venues.value.length > 0) {
        applyExplorePageSeo(venues.value, language.value);
      } else {
        resetSeoToDefault();
      }
    } else if (route.name === 'about') {
      selectedVenue.value = null;
      showDesktopDetail.value = false;
      const aboutTitle = language.value === 'zh'
        ? '關於 Courts by The Ground | Courts'
        : 'About Courts by The Ground | Courts';
      const aboutDesc = language.value === 'zh'
        ? '了解 Courts by The Ground 如何整理香港運動場地資料、編輯方法及聯絡方式。'
        : 'Learn how Courts by The Ground curates Hong Kong sports venues, our methodology, and how to contact us.';
      document.title = aboutTitle;
      const descEl = document.querySelector('meta[name="description"]');
      if (descEl) descEl.setAttribute('content', aboutDesc);
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && typeof window !== 'undefined') {
        canonical.setAttribute('href', `${window.location.origin}/about`);
      }
    } else if (route.name === 'blog') {
      selectedVenue.value = null;
      showDesktopDetail.value = false;
      applyBlogListSeo(language.value);
    } else if (route.name === 'blog-post') {
      selectedVenue.value = null;
      showDesktopDetail.value = false;
    } else if (route.name === 'home' || route.name === 'admin') {
      if (route.name === 'home') {
        currentTab.value = 'explore';
        sportFilter.value = [];
        districtFilter.value = [];
        mtrFilter.value = [];
        distanceFilter.value = '';
        filterSpecialOffer.value = false;
        filterSavedOnly.value = false;
        selectedVenue.value = null;
        showDesktopDetail.value = false;
        if (venues.value.length > 0) {
          applyLandingPageSeo(venues.value, sports.value, language.value);
        }
      } else {
        currentTab.value = 'admin';
      }
    }
  },
  { immediate: true }
);

watch(
  () => venues.value,
  () => {
    syncSelectedVenueFromList();
    if (editingVenue.value?.id != null) {
      const fresh = venues.value.find((v) => v.id === editingVenue.value!.id);
      if (fresh) editingVenue.value = fresh;
    }
    if (route.name === 'home' && venues.value.length > 0) {
      applyLandingPageSeo(venues.value, sports.value, language.value);
    }
    if (route.name === 'explore' && venues.value.length > 0) {
      applyExplorePageSeo(venues.value, language.value);
    }
    if (route.name === 'search' && typeof route.params.sport === 'string') {
      applySearchPageSeo(route.params.sport, venues.value, sports.value, language.value);
    }
    if (
      route.name === 'search-district'
      && typeof route.params.sport === 'string'
      && typeof route.params.district === 'string'
    ) {
      applyDistrictSportPageSeo(
        route.params.sport,
        route.params.district,
        venues.value,
        sports.value,
        language.value,
      );
    }
  }
);

watch(
  () => language.value,
  () => {
    if (route.name === 'home' && venues.value.length > 0) {
      applyLandingPageSeo(venues.value, sports.value, language.value);
    }
    if (route.name === 'about') {
      document.title = language.value === 'zh'
        ? '關於 Courts by The Ground | Courts'
        : 'About Courts by The Ground | Courts';
    }
    if (route.name === 'blog') {
      applyBlogListSeo(language.value);
    }
    if (route.name === 'explore' && venues.value.length > 0) {
      applyExplorePageSeo(venues.value, language.value);
    }
    if (route.name === 'search' && typeof route.params.sport === 'string') {
      applySearchPageSeo(route.params.sport, venues.value, sports.value, language.value);
    }
    if (
      route.name === 'search-district'
      && typeof route.params.sport === 'string'
      && typeof route.params.district === 'string'
    ) {
      applyDistrictSportPageSeo(
        route.params.sport,
        route.params.district,
        venues.value,
        sports.value,
        language.value,
      );
    }
  }
);

watch(
  () => sports.value,
  () => {
    if (route.name === 'search' || route.name === 'search-district') return;
    if (sportFilter.value.length > 0) return;
    applyDefaultSportFilter();
  },
  { immediate: true, deep: true }
);

watch(
  () => venues.value.length,
  () => {
    if (route.name === 'search' || route.name === 'search-district') return;
    if (sportFilter.value.length > 0) return;
    applyDefaultSportFilter();
  }
);

watch(
  () => route.name,
  (name) => {
    if (grindUpcomingPollTimer) {
      clearInterval(grindUpcomingPollTimer);
      grindUpcomingPollTimer = null;
    }
    // Home: 1 page only (warm cache, avoid multi‑MB parallel fetches).
    // Upcoming list: full fetch for the standalone page.
    if (name === 'home') {
      void refreshGrindUpcomingEvents({ maxPages: 1 });
      grindUpcomingPollTimer = setInterval(() => {
        void refreshGrindUpcomingEvents({ maxPages: 1 });
      }, HOME_GRIND_POLL_MS);
    } else if (name === 'upcoming-events') {
      void refreshGrindUpcomingEvents({ maxPages: 20 });
      grindUpcomingPollTimer = setInterval(() => {
        void refreshGrindUpcomingEvents({ maxPages: 20 });
      }, HOME_GRIND_POLL_MS);
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (isAdminPath()) showAdminLogin.value = true;
  const onPopState = () => { showAdminLogin.value = isAdminPath(); };
  window.addEventListener('popstate', onPopState);
  (window as any).__adminPopState = onPopState;

  const restoreAdminSession = async () => {
    // Session cookie is httpOnly — always verify with the API (document.cookie cannot see it).
    try {
      const res = await fetch(courtApiUrl('/api/auth/session'), { method: 'GET', credentials: 'include' });
      if (!res.ok) throw new Error('No admin session');
      const data = await res.json();
      if (!data?.type || data.type === 'none') throw new Error('No admin session');
      adminStatus.value = { type: data.type === 'super' ? 'super' : 'court', allowedIds: data.allowedVenueIds || [] };
      if (isAdminPath()) currentTab.value = 'admin';
    } catch {
      adminStatus.value = { type: 'none', allowedIds: [] };
      superAdminSyncPassword.value = '';
    }
  };
  void loadData();
  void restoreAdminSession();

  try {
    const saved = localStorage.getItem('pickleball_saved_ids');
    savedVenues.value = saved ? JSON.parse(saved) : [];
  } catch {
    savedVenues.value = [];
  }

  if (darkMode.value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
});

onUnmounted(() => {
  if (grindUpcomingPollTimer) {
    clearInterval(grindUpcomingPollTimer);
    grindUpcomingPollTimer = null;
  }
  const onPopState = (window as any).__adminPopState;
  if (onPopState) window.removeEventListener('popstate', onPopState);
});

// All unique MTR stations from DB (trimmed, deduped, sorted)
const availableStations = computed(() => {
  const stations = venues.value
    .map(v => (v.mtrStation || '').trim())
    .filter((s): s is string => s.length > 0);
  return Array.from(new Set(stations)).sort((a, b) => a.localeCompare(b));
});

watch(savedVenues, (val) => {
  try {
    localStorage.setItem('pickleball_saved_ids', JSON.stringify(val));
  } catch (e) {
    console.warn('Could not save IDs to localStorage', e);
  }
}, { deep: true });

watch(darkMode, (value) => {
  localStorage.setItem('pickleball_darkmode', value.toString());
  if (value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
});

const t = (key: string) => translate(language.value, key);

function getDefaultSportSlug(): string | null {
  const defaultSport = sports.value.find((s) => s.id === 1);
  return defaultSport?.slug ?? null;
}

function venueMatchesSportSlug(venue: Venue, sportSlug: string): boolean {
  const slug = (sportSlug || '').toLowerCase().trim();
  if (!slug) return false;
  const types = venue.sport_types;
  const data = venue.sport_data;
  const name = ((venue as any).name ?? '').toString().toLowerCase();
  const desc = ((venue as any).description ?? '').toString().toLowerCase();
  const hasSportBySlug = Array.isArray(data) && data.some((d: any) => String(d.slug || '').toLowerCase().trim() === slug);
  const hasSportByName = Array.isArray(types) && types.some((t: string) => String(t).toLowerCase().trim() === slug);
  return hasSportBySlug || hasSportByName || name.includes(slug) || desc.includes(slug);
}

function applyDefaultSportFilter() {
  const defaultSlug = getDefaultSportSlug();
  if (!defaultSlug) {
    sportFilter.value = [];
    return;
  }
  const hasMatchingVenue = venues.value.some((v) => venueMatchesSportSlug(v, defaultSlug));
  sportFilter.value = hasMatchingVenue ? [defaultSlug] : [];
}

const clearFilters = () => {
  searchQuery.value = '';
  mtrFilter.value = [];
  districtFilter.value = [];
  distanceFilter.value = '';
  applyDefaultSportFilter();
  filterSpecialOffer.value = false;
  filterSavedOnly.value = false;
  locationVenueIds.value = null;
};

async function readApiErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === 'string' && data.error.trim()) return data.error.trim();
  } catch {
    // ignore non-JSON
  }
  return `HTTP ${res.status}`;
}

const handleAdminLogin = async () => {
  if (isAdminLoggingIn.value) return;
  isAdminLoggingIn.value = true;
  try {
    const res = await fetch(courtApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password: adminPassword.value })
    });
    if (res.ok) {
      const data = await res.json();
      adminStatus.value = { type: data.type === 'super' ? 'super' : 'court', allowedIds: data.allowedVenueIds || [] };
      if (data.type === 'super') {
        superAdminSyncPassword.value = adminPassword.value;
      } else {
        superAdminSyncPassword.value = '';
      }
      showAdminLogin.value = false;
      adminPassword.value = '';
      currentTab.value = 'admin';
      invalidateVenuesCache();
      await loadData();
    } else {
      const msg = await readApiErrorMessage(res);
      alert(msg === 'Invalid password' ? 'Incorrect password' : `Login failed: ${msg}`);
    }
  } catch (e) {
    const detail = e instanceof Error && e.message ? e.message : 'network error';
    alert(`Login failed: ${detail}\nAPI: ${courtApiUrl('/api/auth/login')}`);
  } finally {
    isAdminLoggingIn.value = false;
  }
};

const handleAdminLoginFromUserLoginPage = async (password: string) => {
  if (isAdminLoggingIn.value) return;
  isAdminLoggingIn.value = true;
  const pwd = (password || '').toString();

  try {
    const res = await fetch(courtApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password: pwd })
    });
    if (res.ok) {
      const data = await res.json();
      adminStatus.value = { type: data.type === 'super' ? 'super' : 'court', allowedIds: data.allowedVenueIds || [] };
      if (data.type === 'super') {
        superAdminSyncPassword.value = pwd;
      } else {
        superAdminSyncPassword.value = '';
      }
      currentTab.value = 'admin';
      invalidateVenuesCache();
      await loadData();
      router.push('/admin');
    } else {
      const msg = await readApiErrorMessage(res);
      alert(msg === 'Invalid password' ? 'Incorrect password' : `Login failed: ${msg}`);
    }
  } catch (e) {
    const detail = e instanceof Error && e.message ? e.message : 'network error';
    alert(`Login failed: ${detail}\nAPI: ${courtApiUrl('/api/auth/login')}`);
  } finally {
    isAdminLoggingIn.value = false;
  }
};

const handleAdminLogout = async () => {
  try {
    await fetch(courtApiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
  } catch {
    // ignore logout request failure; clear local state anyway
  }
  adminStatus.value = { type: 'none', allowedIds: [] };
  superAdminSyncPassword.value = '';
  currentTab.value = 'explore';
  if (route.name === 'admin') {
    await router.push('/');
  }
  invalidateVenuesCache();
  await loadData();
};

const filteredVenues = computed(() => {
  let source = venues.value;
  if (currentTab.value === 'saved') {
    source = venues.value.filter(v => savedVenues.value.includes(v.id));
  } else if (filterSavedOnly.value) {
    source = venues.value.filter(v => savedVenues.value.includes(v.id));
  }

  const mtrCanonicalSet =
    mtrFilter.value.length > 0
      ? new Set(mtrFilter.value.map((s) => getStationCanonicalEn(s)).filter(Boolean))
      : null;

  const selectedSlugs = sportFilter.value.map((s) => (s || '').toLowerCase().trim()).filter(Boolean);

  const filtered = source.filter(venue => {
    const query = (searchQuery.value || '').toLowerCase();
    const name = ((venue as any).name ?? '').toString().toLowerCase();
    const station = ((venue as any).mtrStation ?? '').toString().toLowerCase();
    const address = ((venue as any).address ?? '').toString().toLowerCase();
    const nameMatch = name.includes(query) || station.includes(query) || address.includes(query);
    const venueStation = (((venue as any).mtrStation ?? '') as string).toString().trim();
    const venueStationKey = getStationCanonicalEn(venueStation);
    const mtrMatch = !mtrCanonicalSet || (venueStationKey && mtrCanonicalSet.has(venueStationKey));
    const districtMatch = venueMatchesDistricts(venue, districtFilter.value);
    const wdRaw = (venue as any).walkingDistance;
    const wd = typeof wdRaw === 'number' ? wdRaw : parseFloat((wdRaw ?? '').toString());
    const distanceLimit = distanceFilter.value ? parseInt(distanceFilter.value) : NaN;
    const distanceMatch = !distanceFilter.value || (Number.isFinite(wd) && wd <= distanceLimit);
    let sportMatch = true;
    if (selectedSlugs.length > 0) {
      const types = (venue as Venue).sport_types;
      const data = (venue as Venue).sport_data;
      const desc = ((venue as any).description ?? '').toString().toLowerCase();
      sportMatch = selectedSlugs.some((sport) => {
        const hasSportBySlug = Array.isArray(data) && data.some((d: any) => String(d.slug || '').toLowerCase().trim() === sport);
        const hasSportByName = Array.isArray(types) && types.some((t: string) => String(t).toLowerCase().trim() === sport);
        return hasSportBySlug || hasSportByName || name.includes(sport) || desc.includes(sport);
      });
    }
    const specialOfferMatch = !filterSpecialOffer.value || Boolean((venue as Venue).membership_enabled);
    return nameMatch && mtrMatch && districtMatch && distanceMatch && sportMatch && specialOfferMatch;
  });

  const venueSortKey = (v: Venue, slug?: string) => {
    if (slug) {
      const fromOrders = v.sport_orders?.[slug];
      if (typeof fromOrders === 'number') return fromOrders;
      const fromData = v.sport_data?.find((d: any) => String(d.slug || '').toLowerCase().trim() === slug)?.sort_order;
      if (typeof fromData === 'number') return fromData;
    }
    return v.sort_order ?? 9999;
  };

  // Single sport → per-sport order; none/multi → global venues.sort_order
  const sortSlug = selectedSlugs.length === 1 ? selectedSlugs[0] : undefined;
  return filtered.slice().sort((a, b) => {
    const ao = venueSortKey(a as Venue, sortSlug);
    const bo = venueSortKey(b as Venue, sortSlug);
    if (ao !== bo) return ao - bo;
    return String((a as Venue).name || '').localeCompare(String((b as Venue).name || ''));
  });
});

const selectedVenueIndex = computed(() => {
  if (!selectedVenue.value) return -1;
  return filteredVenues.value.findIndex((v) => v.id === selectedVenue.value?.id);
});

const prevVenue = computed(() => {
  const n = filteredVenues.value.length;
  const idx = selectedVenueIndex.value;
  if (n === 0 || idx < 0) return null;
  const prevIndex = (idx - 1 + n) % n;
  return filteredVenues.value[prevIndex] || null;
});

const nextVenue = computed(() => {
  const n = filteredVenues.value.length;
  const idx = selectedVenueIndex.value;
  if (n === 0 || idx < 0) return null;
  const nextIndex = (idx + 1) % n;
  return filteredVenues.value[nextIndex] || null;
});

async function goToPrevVenue() {
  const target = prevVenue.value;
  if (!target) return;
  selectedVenue.value = target;
  showDesktopDetail.value = true;
  await router.push('/venues/' + useVenueSlug(target));
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

async function goToNextVenue() {
  const target = nextVenue.value;
  if (!target) return;
  selectedVenue.value = target;
  showDesktopDetail.value = true;
  await router.push('/venues/' + useVenueSlug(target));
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

/** List for left/filter side: when a pin is clicked, only venues at that location; otherwise all filtered. */
const listVenues = computed(() => {
  if (!locationVenueIds.value || locationVenueIds.value.length === 0) return filteredVenues.value;
  const idSet = new Set(locationVenueIds.value);
  return filteredVenues.value.filter((v) => idSet.has(v.id));
});

const showListingSeoPanel = computed(
  () => route.name === 'explore' || route.name === 'search' || route.name === 'search-district',
);

const listingSeoMode = computed<'explore' | 'search' | 'search-district'>(() => {
  if (route.name === 'search-district') return 'search-district';
  if (route.name === 'search') return 'search';
  return 'explore';
});

const listingSeoSport = computed(() => {
  const slug = typeof route.params.sport === 'string' ? route.params.sport : sportFilter.value[0];
  if (!slug) return { slug: '', name: '' };
  const meta = sports.value.find((s) => s.slug === slug);
  const name = meta
    ? (language.value === 'zh' && meta.name_zh ? meta.name_zh : meta.name)
    : slug.replace(/-/g, ' ');
  return { slug, name };
});

const listingSeoDistrictSlug = computed(() =>
  typeof route.params.district === 'string' ? route.params.district : '',
);

const listingSeoProps = computed(() => {
  if (!showListingSeoPanel.value) return null;
  return {
    mode: listingSeoMode.value,
    sportName: listingSeoSport.value.name || undefined,
    sportSlug: listingSeoSport.value.slug || undefined,
    districtSlug: listingSeoDistrictSlug.value || undefined,
    venueCount: filteredVenues.value.length,
  };
});

const showVenuesAtLocation = (venueList: Venue[]) => {
  locationVenueIds.value = venueList.map((v) => v.id);
};

const clearVenuesAtLocation = () => {
  locationVenueIds.value = null;
};

function goToExplore(filters?: { mtr?: string; sport?: string; districts?: string[]; specialOffer?: boolean }) {
  if (filters?.districts?.length) {
    districtFilter.value = [...filters.districts];
    mtrFilter.value = [];
  } else if (filters?.mtr) {
    mtrFilter.value = [filters.mtr];
    districtFilter.value = [];
  }
  if (filters?.sport) {
    sportFilter.value = [filters.sport];
  } else if (sportFilter.value.length === 0) {
    applyDefaultSportFilter();
  }
  if (filters?.specialOffer !== undefined) {
    filterSpecialOffer.value = filters.specialOffer;
  }
  currentTab.value = 'explore';
  selectedVenue.value = null;
  showDesktopDetail.value = false;
  router.push('/explore');
}

function goToLandingVenue(venue: Venue) {
  router.push('/venues/' + useVenueSlug(venue));
}

function goBackFromVenue() {
  resetSeoToDefault();
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
  } else {
    router.push('/explore');
  }
}

const toggleSaveVenue = (venueId: number) => {
  savedVenues.value = savedVenues.value.includes(venueId)
    ? savedVenues.value.filter(id => id !== venueId)
    : [...savedVenues.value, venueId];
};

const confirmDeleteAction = async () => {
  if (!venueToDelete.value) return;
  try {
    await db.deleteVenue(venueToDelete.value.id);
    venues.value = venues.value.filter(v => v.id !== venueToDelete.value!.id);
    savedVenues.value = savedVenues.value.filter(id => id !== venueToDelete.value!.id);
    invalidateVenuesCache();
  } catch (err) {
    alert('Failed to delete venue.');
  } finally {
    venueToDelete.value = null;
    showVenueForm.value = false;
    editingVenue.value = null;
    selectedVenue.value = null;
  }
};

const adminNotification = ref<{ type: 'success' | 'error'; message: string } | null>(null);
let adminNotificationTimer: ReturnType<typeof setTimeout> | null = null;

const showAdminNotification = (type: 'success' | 'error', message: string) => {
  if (adminNotificationTimer) clearTimeout(adminNotificationTimer);
  adminNotification.value = { type, message };
  adminNotificationTimer = setTimeout(() => {
    adminNotification.value = null;
    adminNotificationTimer = null;
  }, 3500);
};

const handleSaveVenue = async (venueData: any) => {
  try {
    const editingId = editingVenue.value?.id ?? null;
    const previousVenue = editingVenue.value;
    const saved = await db.upsertVenue(venueData, { isSuperAdmin: isSuperAdmin.value });
    let merged = saved;
    if (isSuperAdmin.value) {
      if (venueData.clear_admin_password) {
        merged = { ...saved, admin_password: '', has_admin_password: false };
      } else if (venueData.admin_password) {
        merged = { ...saved, admin_password: venueData.admin_password, has_admin_password: true };
      } else if (previousVenue?.admin_password) {
        merged = { ...saved, admin_password: previousVenue.admin_password, has_admin_password: true };
      }
    }
    if (editingVenue.value) {
      venues.value = venues.value.map(old => old.id === merged.id ? merged : old);
    } else {
      venues.value = [...venues.value, merged];
    }
    invalidateVenuesCache();
    showVenueForm.value = false;
    editingVenue.value = null;
    if (editingId != null && selectedVenue.value?.id === editingId) {
      selectedVenue.value = merged;
      if (route.name === 'venue') {
        await router.push('/venues/' + useVenueSlug(saved));
      }
    } else if (editingId == null) {
      selectedVenue.value = null;
    }
    showAdminNotification('success', t('saveSuccess'));
  } catch (err: any) {
    showAdminNotification('error', err?.message || t('saveFailed'));
    throw err;
  }
};

</script>

<template>
  <div :class="['min-h-screen w-full pb-safe transition-colors', darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900']">
    <UserLoginPage
      v-if="route.name === 'login'"
      :language="language"
      :t="t"
      :darkMode="darkMode"
      :onAdminLogin="handleAdminLoginFromUserLoginPage"
    />
    <UserSignUpPage
      v-else-if="route.name === 'signup'"
      :language="language"
      :t="t"
      :darkMode="darkMode"
    />

    <TokenLoginPage
      v-else-if="route.name === 'token-login'"
      :language="language"
      :t="t"
      :darkMode="darkMode"
    />

    <CompletePhonePage
      v-else-if="route.name === 'complete-phone'"
      :language="language"
      :t="t"
      :darkMode="darkMode"
    />
    
    <UpcomingEventsPage
      v-else-if="route.name === 'upcoming-events'"
      :language="language"
      :t="t"
      :darkMode="darkMode"
    />

    <Header
      v-else
      :language="language"
      :setLanguage="(l: Language) => { language = l; }"
      :isAdmin="isAnyAdmin"
      :onAdminClick="() => { currentTab = 'admin'; selectedVenue = null; showDesktopDetail = false; router.push('/admin'); }"
      :onLoginClick="() => { router.push('/login'); }"
      :showLogout="showLogout"
      :onUserLogout="handleUserLogout"
      :darkMode="darkMode"
      :setDarkMode="(d: boolean) => { darkMode = d; }"
      :t="t"
      :currentTab="currentTab"
      :setTab="(tab: AppTab) => {
        if (tab === 'admin' && !isAnyAdmin) {
          showAdminLogin = true;
          return;
        }
        if (tab === 'admin') {
          currentTab = 'admin';
          selectedVenue = null;
          showDesktopDetail = false;
          router.push('/admin');
          return;
        }
        currentTab = tab;
        if (tab === 'explore') { goToExplore(); }
        else if (tab === 'saved') { goToExplore(); currentTab = 'saved'; filterSavedOnly = true; }
        else { selectedVenue = null; showDesktopDetail = false; }
      }"
      :viewMode="mobileViewMode"
      :setViewMode="(mode: 'map' | 'list') => { mobileViewMode = mode; }"
      :filterSpecialOffer="filterSpecialOffer"
      :setFilterSpecialOffer="(v: boolean) => { filterSpecialOffer = v; }"
      :hideNavTabs="!!selectedVenue && (route.name === 'venue' || showDesktopDetail)"
    />

    <main
      v-if="route.name !== 'login' && route.name !== 'signup' && route.name !== 'token-login' && route.name !== 'complete-phone' && route.name !== 'upcoming-events'"
      class="w-full"
      :class="route.name === 'home' ? '' : 'h-full'"
    >
      <AdminPage
        v-if="route.name === 'admin' && isAnyAdmin && !selectedVenue"
        :venues="venues"
        :sports="sports"
        :language="language"
        :t="t"
        :dark-mode="darkMode"
        :is-super-admin="isSuperAdmin"
        :super-admin-sync-password="superAdminSyncPassword"
        :admin-status="adminStatus"
        @add-venue="() => openVenueForm(null)"
        @edit-venue="(v) => openVenueForm(v)"
        @delete-venue="(v) => { venueToDelete = v; }"
        @logout="handleAdminLogout"
        @update:venues="(v) => { venues = v; invalidateVenuesCache(); }"
        @update:sports="(s) => { sports = s; }"
        @reload-venues="loadData"
        @notify="showAdminNotification"
      />

      <div v-else class="flex flex-col flex-1 min-h-0 w-full">
        <div
          v-if="isLoading"
          class="flex-1 p-4 md:p-6 animate-in fade-in duration-300"
          aria-busy="true"
          aria-label="Loading courts"
        >
          <div class="max-w-4xl mx-auto space-y-4">
            <div
              v-for="i in 6"
              :key="i"
              class="rounded-2xl overflow-hidden border shadow-sm flex gap-4 p-4 items-center"
              :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'"
            >
              <div
                class="w-16 h-16 md:w-20 md:h-20 rounded-xl flex-shrink-0 animate-pulse"
                :class="darkMode ? 'bg-gray-700' : 'bg-gray-300'"
              />
              <div class="flex-1 min-w-0 space-y-2">
                <div
                  class="h-5 w-3/4 rounded animate-pulse"
                  :class="darkMode ? 'bg-gray-700' : 'bg-gray-300'"
                />
                <div
                  class="h-4 w-1/2 rounded animate-pulse"
                  :class="darkMode ? 'bg-gray-700' : 'bg-gray-300'"
                />
                <div
                  class="h-4 w-1/4 rounded animate-pulse"
                  :class="darkMode ? 'bg-gray-700' : 'bg-gray-300'"
                />
              </div>
            </div>
          </div>
          <p class="text-center font-black text-sm tracking-widest opacity-50 uppercase mt-6">
            Syncing Courts...
          </p>
        </div>

        <LandingPage
          v-else-if="route.name === 'home'"
          :venues="venues"
          :filteredVenues="filteredVenues"
          :listVenues="listVenues"
          :sports="sports"
          :availableStations="availableStations"
          :language="language"
          :t="t"
          :darkMode="darkMode"
          :isMobile="isMobile"
          :savedVenues="savedVenues"
          :toggleSave="toggleSaveVenue"
          :selectedVenue="selectedVenue"
          :onSelectVenue="(v: Venue | null) => { selectedVenue = v; }"
          :searchQuery="searchQuery"
          :setSearchQuery="(s: string) => { searchQuery = s; }"
          :mtrFilter="mtrFilter"
          :setMtrFilter="(arr: string[]) => { mtrFilter = arr; }"
          :districtFilter="districtFilter"
          :setDistrictFilter="(arr: string[]) => { districtFilter = arr; }"
          :distanceFilter="distanceFilter"
          :setDistanceFilter="(s: string) => { distanceFilter = s; }"
          :sportFilter="sportFilter"
          :setSportFilter="(arr: string[]) => { sportFilter = arr; }"
          :filterSpecialOffer="filterSpecialOffer"
          :setFilterSpecialOffer="(v: boolean) => { filterSpecialOffer = v; }"
          :filterSavedOnly="filterSavedOnly"
          :setFilterSavedOnly="(v: boolean) => { filterSavedOnly = v; }"
          :onClearFilters="clearFilters"
          :onShowVenuesAtLocation="showVenuesAtLocation"
          :hasLocationFilter="!!(locationVenueIds && locationVenueIds.length)"
          :onClearLocationFilter="clearVenuesAtLocation"
          :currentTab="currentTab"
          :setTab="(tab: AppTab) => { currentTab = tab; }"
          :isAdmin="isAnyAdmin"
          :canEditVenue="canEditVenue"
          :onAddVenue="() => openVenueForm(null)"
          :onEditVenue="(id: number, v: Venue) => openVenueForm(v)"
          :onDeleteVenue="(id: number) => {
            const target = venues.find(v => v.id === id);
            if (target) venueToDelete = target;
          }"
          :onViewVenue="goToLandingVenue"
          :onViewDetail="(v: Venue) => { selectedVenue = v; showDesktopDetail = true; router.push('/venues/' + useVenueSlug(v)); }"
          :onExplore="goToExplore"
          :setLanguage="(l: Language) => { language = l; }"
        />

        <AboutPage
          v-else-if="route.name === 'about'"
          :language="language"
          :t="t"
          :dark-mode="darkMode"
          :set-language="(l: Language) => { language = l; }"
        />

        <BlogListPage
          v-else-if="route.name === 'blog'"
          :language="language"
          :t="t"
          :dark-mode="darkMode"
          :set-language="(l: Language) => { language = l; }"
        />

        <BlogPostPage
          v-else-if="route.name === 'blog-post'"
          :language="language"
          :t="t"
          :dark-mode="darkMode"
          :set-language="(l: Language) => { language = l; }"
          @post-loaded="(post) => applyBlogPostSeo(post, language)"
        />

        <template
          v-else-if="isMobile && (route.name === 'explore' || route.name === 'search' || route.name === 'search-district' || route.name === 'venue')"
        >
        <MobileView
          :mode="mobileViewMode"
          :setMode="(m: 'map' | 'list') => { mobileViewMode = m; }"
          :venues="filteredVenues"
          :selectedVenue="selectedVenue"
          :onSelectVenue="(v: Venue | null) => { selectedVenue = v; }"
          :searchQuery="searchQuery"
          :setSearchQuery="(s: string) => { searchQuery = s; }"
          :mtrFilter="mtrFilter"
          :setMtrFilter="(arr: string[]) => { mtrFilter = arr; }"
          :districtFilter="districtFilter"
          :setDistrictFilter="(arr: string[]) => { districtFilter = arr; }"
          :distanceFilter="distanceFilter"
          :setDistanceFilter="(s: string) => { distanceFilter = s; }"
          :language="language"
          :t="t"
          :darkMode="darkMode"
          :savedVenues="savedVenues"
          :toggleSave="toggleSaveVenue"
          :isAdmin="isAnyAdmin"
          :canEditVenue="canEditVenue"
          :onEditVenue="(id: number, v: any) => openVenueForm(v)"
          :availableStations="availableStations"
          :onClearFilters="clearFilters"
          :sportFilter="sportFilter"
          :setSportFilter="(arr: string[]) => { sportFilter = arr; }"
          :sports="sports"
          :filterSpecialOffer="filterSpecialOffer"
          :setFilterSpecialOffer="(v: boolean) => { filterSpecialOffer = v; }"
          :filterSavedOnly="filterSavedOnly"
          :setFilterSavedOnly="(v: boolean) => { filterSavedOnly = v; }"
          :currentTab="currentTab"
          :onOpenDetail="(v: Venue) => { router.push('/venues/' + useVenueSlug(v)); }"
          :onBackFromDetail="goBackFromVenue"
          :force-show-detail="route.name === 'venue' && !!selectedVenue"
          :listing-seo="listingSeoProps"
        />
        </template>

        <VenueDetail
          v-else-if="showDesktopDetail && selectedVenue"
          :key="`${selectedVenue.id}-${selectedVenue.mtrStation || ''}-${selectedVenue.walkingDistance || 0}`"
          :venue="selectedVenue"
          :onBack="() => { selectedVenue = null; showDesktopDetail = false; goBackFromVenue(); }"
          :onPrevVenue="goToPrevVenue"
          :onNextVenue="goToNextVenue"
          :hasPrevVenue="!!prevVenue"
          :hasNextVenue="!!nextVenue"
          :language="language"
          :t="t"
          :darkMode="darkMode"
          :savedVenues="savedVenues"
          :toggleSave="toggleSaveVenue"
          :isAdmin="isAnyAdmin"
          :canEdit="canEditVenue(selectedVenue.id)"
          :onEdit="() => openVenueForm(selectedVenue)"
        />

        <template
          v-else-if="!isMobile && (route.name === 'explore' || route.name === 'search' || route.name === 'search-district' || (route.name === 'venue' && !showDesktopDetail))"
        >
        <DesktopView
          :venues="filteredVenues"
          :listVenues="listVenues"
          :onShowVenuesAtLocation="showVenuesAtLocation"
          :hasLocationFilter="!!(locationVenueIds && locationVenueIds.length)"
          :onClearLocationFilter="clearVenuesAtLocation"
          :selectedVenue="selectedVenue"
          :onSelectVenue="(v: Venue | null) => { selectedVenue = v; }"
          :onViewDetail="(v: Venue) => { selectedVenue = v; showDesktopDetail = true; router.push('/venues/' + useVenueSlug(v)); }"
          :searchQuery="searchQuery"
          :setSearchQuery="(s: string) => { searchQuery = s; }"
          :mtrFilter="mtrFilter"
          :setMtrFilter="(arr: string[]) => { mtrFilter = arr; }"
          :districtFilter="districtFilter"
          :setDistrictFilter="(arr: string[]) => { districtFilter = arr; }"
          :distanceFilter="distanceFilter"
          :setDistanceFilter="(s: string) => { distanceFilter = s; }"
          :language="language"
          :t="t"
          :darkMode="darkMode"
          :savedVenues="savedVenues"
          :toggleSave="toggleSaveVenue"
          :isAdmin="isAnyAdmin"
          :canEditVenue="canEditVenue"
          :onAddVenue="() => openVenueForm(null)"
          :onEditVenue="(id: number, v: any) => openVenueForm(v)"
          :onDeleteVenue="(id: number) => {
            const target = venues.find(v => v.id === id);
            if (target) venueToDelete = target;
          }"
          :availableStations="availableStations"
          :onClearFilters="clearFilters"
          :sportFilter="sportFilter"
          :setSportFilter="(arr: string[]) => { sportFilter = arr; }"
          :sports="sports"
          :filterSpecialOffer="filterSpecialOffer"
          :setFilterSpecialOffer="(v: boolean) => { filterSpecialOffer = v; }"
          :filterSavedOnly="filterSavedOnly"
          :setFilterSavedOnly="(v: boolean) => { filterSavedOnly = v; }"
          :currentTab="currentTab"
          :setTab="(t: AppTab) => { currentTab = t; }"
          :listing-seo="listingSeoProps"
        />
        </template>
      </div>
    </main>

    <AdminLogin
      v-if="showAdminLogin"
      :password="adminPassword"
      :setPassword="(val: string) => { adminPassword = val; }"
      :onLogin="handleAdminLogin"
      :onClose="() => { showAdminLogin = false; syncAdminUrl(false); }"
      :isLoading="isAdminLoggingIn"
      :language="language"
      :t="t"
      :darkMode="darkMode"
    />

    <VenueForm
      v-if="showVenueForm"
      :key="editingVenue?.id ?? 'new'"
      :venue="editingVenue"
      :sports="sports"
      :isSuperAdmin="isSuperAdmin"
      :onSave="handleSaveVenue"
      :onCancel="() => { showVenueForm = false; editingVenue = null; }"
      :onDelete="(id: number) => {
        const target = venues.find(v => v.id === id);
        if (target) venueToDelete = target;
      }"
      :language="language"
      :t="t"
      :darkMode="darkMode"
    />

    <div
      v-if="venueToDelete"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      class="fixed inset-0 bg-black/90 z-[999] flex items-center justify-center p-4 backdrop-blur-md"
    >
      <div
        class="w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-bounce-in"
        :class="darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'"
      >
        <div class="text-center space-y-4">
          <div class="text-6xl mb-2">⚠️</div>
          <h3
            id="delete-dialog-title"
            class="text-2xl font-black"
          >
            {{ language === 'en' ? 'Delete Court?' : '刪除場地？' }}
          </h3>
          <p
            class="text-sm font-bold px-2"
            :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
          >
            {{
              language === 'en'
                ? `Are you sure you want to delete "${venueToDelete!.name}"?`
                : `確定要刪除「${venueToDelete!.name}」嗎？`
            }}
          </p>
          <div class="flex flex-col gap-3 pt-6">
            <button
              class="w-full py-4 bg-red-500 text-white rounded-lg font-black"
              @click="confirmDeleteAction"
            >
              {{ language === 'en' ? 'YES, DELETE IT' : '確定刪除' }}
            </button>
            <button
              class="w-full py-4 rounded-lg font-black"
              :class="darkMode ? 'bg-gray-700' : 'bg-gray-200'"
              @click="() => { venueToDelete = null; }"
            >
              {{ language === 'en' ? 'NO, CANCEL' : '取消' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Admin save notification toast -->
    <Transition name="notification">
      <div
        v-if="adminNotification"
        role="alert"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-4 rounded-[14px] shadow-xl max-w-[90vw] animate-in slide-in-from-bottom-4 duration-300"
        :class="adminNotification.type === 'success'
          ? 'bg-[#007a67] text-white'
          : 'bg-red-500 text-white'"
      >
        <span class="text-2xl">{{ adminNotification.type === 'success' ? '✓' : '⚠️' }}</span>
        <p class="text-[14px] font-bold">
          {{ adminNotification.message }}
        </p>
      </div>
    </Transition>

    <!--<MobileNav
      v-if="isMobile && route.name !== 'login' && route.name !== 'signup' && route.name !== 'token-login' && route.name !== 'complete-phone'"
      :currentTab="currentTab"
      :setTab="(t: AppTab) => { currentTab = t; }"
      :t="t"
      :darkMode="darkMode"
      :isAdmin="isAnyAdmin"
      :onAdminClick="() => { if (isAnyAdmin) currentTab = 'admin'; else { showAdminLogin = true; syncAdminUrl(true); } }"
    />-->
  </div>
</template>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.notification-enter-from,
.notification-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}
</style>
