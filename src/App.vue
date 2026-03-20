<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Venue, Language, AppTab, Sport } from '../types';
import { translate } from './utils/translations';
import { getStationCanonicalEn } from './utils/mtrStations';
import { slugify } from './utils/slugify';
import { resetSeoToDefault, applySearchPageSeo } from './utils/seo';
import { useVenueSlug } from './router';
import { db } from '../db';
import Header from './components/Header.vue';
import AdminLogin from './components/AdminLogin.vue';
import DesktopView from './components/DesktopView.vue';
import MobileView from './components/MobileView.vue';
import MobileNav from './components/MobileNav.vue';
import VenueDetail from './components/VenueDetail.vue';
import VenueForm from './components/VenueForm.vue';

const route = useRoute();
const router = useRouter();

const language = ref<Language>('zh');
const currentTab = ref<AppTab>('explore');
const adminPassword = ref('');
const showAdminLogin = ref(false);
const showVenueForm = ref(false);
const editingVenue = ref<Venue | null>(null);
const venueToDelete = ref<Venue | null>(null);
const isLoading = ref(true);
const mobileViewMode = ref<'map' | 'list'>('list');

const venues = ref<Venue[]>([]);
const sports = ref<{ id: number; name: string; name_zh?: string | null; slug: string }[]>([]);
const savedVenues = ref<number[]>([]);
const adminSportFilter = ref<string>('all'); // 'all' | sport slug
const showAddSportInput = ref(false);
const newSportName = ref('');
const newSportNameZh = ref('');
const addSportError = ref<string | null>(null);
const isAddingSport = ref(false);

const sportDisplayName = (s: { name: string; name_zh?: string | null }) =>
  language.value === 'zh' && s.name_zh ? s.name_zh : s.name;

const selectedVenue = ref<Venue | null>(null);
const showDesktopDetail = ref(false);
const searchQuery = ref('');
const mtrFilter = ref<string[]>([]);
const distanceFilter = ref('');
const sportFilter = ref<string[]>([]); // sport slugs (multi-select)
const filterSpecialOffer = ref(false); // when true, only show venues with membership_enabled
/** When set (after clicking a pin), list shows only venues at that location. */
const locationVenueIds = ref<number[] | null>(null);
const darkMode = ref(localStorage.getItem('pickleball_darkmode') === 'true');
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

const VENUES_CACHE_KEY = 'pickleball_venues_cache';
const VENUES_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

const adminStatus = ref<{ type: 'none' | 'super' | 'court'; allowedIds: number[] }>({ type: 'none', allowedIds: [] });
const isSuperAdmin = computed(() => adminStatus.value.type === 'super');
const isAnyAdmin = computed(() => adminStatus.value.type !== 'none');
const SUPER_ADMIN_PASSWORD = 'abc321A!';

function canEditVenue(venueId: number): boolean {
  if (adminStatus.value.type === 'super') return true;
  if (adminStatus.value.type === 'court') return adminStatus.value.allowedIds.includes(venueId);
  return false;
}
const isEditingSports = ref(false);
const adminSportsList = computed<Sport[]>(() => sports.value);

function setVenuesCache(data: Venue[], ts: number): void {
  try {
    sessionStorage.setItem(VENUES_CACHE_KEY, JSON.stringify({ data, ts }));
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      try {
        sessionStorage.removeItem(VENUES_CACHE_KEY);
      } catch {
        // ignore
      }
    }
    // Skip cache when quota exceeded or any other error; app works without cache
  }
}

const loadData = async () => {
  try {
    // Show cached data immediately for faster repeat loads
    const cachedRaw = sessionStorage.getItem(VENUES_CACHE_KEY);
    if (cachedRaw) {
      try {
        const { data: cached, ts } = JSON.parse(cachedRaw);
        if (Array.isArray(cached) && typeof ts === 'number' && Date.now() - ts < VENUES_CACHE_TTL_MS) {
          venues.value = cached;
          adminOrder.value = cached.map((v: Venue) => v.id);
          saveAdminOrder();
          isLoading.value = false;
          // Revalidate in background
          const [fresh, sportsList] = await Promise.all([
            db.getVenues(isSuperAdmin ? SUPER_ADMIN_PASSWORD : undefined),
            db.getSports()
          ]);
          if (fresh?.length !== undefined) {
            venues.value = fresh;
            adminOrder.value = fresh.map(v => v.id);
            saveAdminOrder();
            setVenuesCache(fresh, Date.now());
          }
          if (sportsList?.length !== undefined) sports.value = sportsList;
          return;
        }
      } catch {
        // ignore invalid cache
      }
    }

    isLoading.value = true;
    const pwd = isSuperAdmin.value ? SUPER_ADMIN_PASSWORD : undefined;
    const [data, sportsList] = await Promise.all([db.getVenues(pwd), db.getSports()]);
    venues.value = data || [];
    sports.value = sportsList || [];
    adminOrder.value = venues.value.map(v => v.id);
    saveAdminOrder();
    setVenuesCache(venues.value, Date.now());
  } catch (err) {
    console.error('Error fetching venues from DB:', err);
  } finally {
    isLoading.value = false;
  }
};

const invalidateVenuesCache = () => {
  sessionStorage.removeItem(VENUES_CACHE_KEY);
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 1024;
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

watch(
  () => ({ name: route.name, slug: route.params.slug, sport: route.params.sport }),
  (params, prev) => {
    if (route.name === 'venue' && typeof route.params.slug === 'string') {
      const venue = resolveVenueBySlug(route.params.slug);
      selectedVenue.value = venue;
      showDesktopDetail.value = !!venue;
      if (!venue && venues.value.length > 0) router.replace('/');
    } else if (route.name === 'search' && typeof route.params.sport === 'string') {
      sportFilter.value = [route.params.sport];
      selectedVenue.value = null;
      showDesktopDetail.value = false;
      applySearchPageSeo(route.params.sport);
    } else if (route.name === 'home' || route.name === 'admin') {
      if (route.name === 'home') {
        sportFilter.value = [];
        if (prev?.name === 'venue') resetSeoToDefault();
        selectedVenue.value = null;
        showDesktopDetail.value = false;
      }
    }
  },
  { immediate: true }
);

watch(
  () => venues.value.length,
  () => {
    if (route.name === 'venue' && typeof route.params.slug === 'string' && !selectedVenue.value) {
      const venue = resolveVenueBySlug(route.params.slug);
      if (venue) {
        selectedVenue.value = venue;
        showDesktopDetail.value = true;
      }
    }
  }
);

onMounted(() => {
  if (isAdminPath()) showAdminLogin.value = true;
  const onPopState = () => { showAdminLogin.value = isAdminPath(); };
  window.addEventListener('popstate', onPopState);
  window.addEventListener('resize', handleResize);
  (window as any).__adminPopState = onPopState;

  loadData();

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
  window.removeEventListener('resize', handleResize);
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

const clearFilters = () => {
  searchQuery.value = '';
  mtrFilter.value = [];
  distanceFilter.value = '';
  sportFilter.value = [];
  filterSpecialOffer.value = false;
  locationVenueIds.value = null;
};

const handleAdminLogin = async () => {
  if (adminPassword.value === SUPER_ADMIN_PASSWORD) {
    adminStatus.value = { type: 'super', allowedIds: [] };
    showAdminLogin.value = false;
    adminPassword.value = '';
    currentTab.value = 'admin';
    invalidateVenuesCache();
    await loadData();
    return;
  }
  try {
    const API_BASE = import.meta.env.VITE_API_URL ?? '';
    const base = API_BASE.replace(/\/$/, '').replace(/\/api$/, '');
    const url = `${base}/api/auth/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword.value })
    });
    if (res.ok) {
      const data = await res.json();
      adminStatus.value = { type: 'court', allowedIds: data.allowedVenueIds };
      showAdminLogin.value = false;
      adminPassword.value = '';
      currentTab.value = 'admin';
    } else {
      alert('Incorrect password');
    }
  } catch (e) {
    alert('Login failed');
  }
};

const filteredVenues = computed(() => {
  let source = venues.value;
  if (currentTab.value === 'saved') {
    source = venues.value.filter(v => savedVenues.value.includes(v.id));
  }

  const mtrCanonicalSet =
    mtrFilter.value.length > 0
      ? new Set(mtrFilter.value.map((s) => getStationCanonicalEn(s)).filter(Boolean))
      : null;

  const selectedSlugs = sportFilter.value.map((s) => (s || '').toLowerCase().trim()).filter(Boolean);

  return source.filter(venue => {
    const query = (searchQuery.value || '').toLowerCase();
    const name = ((venue as any).name ?? '').toString().toLowerCase();
    const station = ((venue as any).mtrStation ?? '').toString().toLowerCase();
    const address = ((venue as any).address ?? '').toString().toLowerCase();
    const nameMatch = name.includes(query) || station.includes(query) || address.includes(query);
    const venueStation = (((venue as any).mtrStation ?? '') as string).toString().trim();
    const venueStationKey = getStationCanonicalEn(venueStation);
    const mtrMatch = !mtrCanonicalSet || (venueStationKey && mtrCanonicalSet.has(venueStationKey));
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
    return nameMatch && mtrMatch && distanceMatch && sportMatch && specialOfferMatch;
  });
});

/** List for left/filter side: when a pin is clicked, only venues at that location; otherwise all filtered. */
const listVenues = computed(() => {
  if (!locationVenueIds.value || locationVenueIds.value.length === 0) return filteredVenues.value;
  const idSet = new Set(locationVenueIds.value);
  return filteredVenues.value.filter((v) => idSet.has(v.id));
});

const showVenuesAtLocation = (venueList: Venue[]) => {
  locationVenueIds.value = venueList.map((v) => v.id);
};

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
    const saved = await db.upsertVenue(venueData, { isSuperAdmin: isSuperAdmin.value });
    if (editingVenue.value) {
      venues.value = venues.value.map(old => old.id === saved.id ? saved : old);
    } else {
      venues.value = [...venues.value, saved];
    }
    invalidateVenuesCache();
    showVenueForm.value = false;
    editingVenue.value = null;
    selectedVenue.value = null;
    showAdminNotification('success', t('saveSuccess'));
  } catch (err: any) {
    showAdminNotification('error', err?.message || t('saveFailed'));
    throw err;
  }
};

const draggedVenueId = ref<number | null>(null);
const adminOrder = ref<number[]>([]);
const isSortEditing = ref(false);
const draftAdminOrder = ref<number[]>([]);

const adminVenues = computed(() => {
  let list = venues.value;
  // If Court Admin, ONLY show their specific venues
  if (adminStatus.value.type === 'court') {
    return list.filter(v => adminStatus.value.allowedIds.includes(v.id));
  }
  if (adminSportFilter.value === 'all') return venues.value;
  const slug = adminSportFilter.value;
  return venues.value
    .filter((v) => {
      const types = v.sport_types;
      const data = v.sport_data;
      if (Array.isArray(data)) return data.some((d: any) => (d.slug || '').toLowerCase() === slug);
      if (Array.isArray(types)) return types.some((t: string) => String(t).toLowerCase().replace(/\s+/g, '-') === slug);
      return false;
    })
    .sort((a, b) => {
      const ao = a.sport_orders?.[slug] ?? a.sport_data?.find((d: any) => (d.slug || '').toLowerCase() === slug)?.sort_order ?? 9999;
      const bo = b.sport_orders?.[slug] ?? b.sport_data?.find((d: any) => (d.slug || '').toLowerCase() === slug)?.sort_order ?? 9999;
      return ao - bo;
    });
});

const getBaseAdminOrder = (): number[] => {
  if (adminSportFilter.value === 'all') return adminOrder.value.length ? [...adminOrder.value] : venues.value.map(v => v.id);
  return adminVenues.value.map(v => v.id);
};

const displayIndexById = computed(() => {
  const order = isSortEditing.value ? draftAdminOrder.value : getBaseAdminOrder();
  const map = new Map<number, number>();
  order.forEach((id, idx) => map.set(id, idx));
  return map;
});

const isDraftDirty = computed(() => {
  if (!isSortEditing.value) return false;
  const base = getBaseAdminOrder();
  const draft = draftAdminOrder.value;
  if (base.length !== draft.length) return true;
  for (let i = 0; i < base.length; i++) {
    if (base[i] !== draft[i]) return true;
  }
  return false;
});

const saveAdminOrder = () => {
  try {
    localStorage.setItem('pickleball_admin_order', JSON.stringify(adminOrder.value));
  } catch {
    // ignore
  }
};

const applyAdminOrder = () => {
  if (!adminOrder.value.length) return;
  const idToVenue = new Map(venues.value.map(v => [v.id, v]));
  const ordered: Venue[] = [];
  adminOrder.value.forEach(id => {
    const v = idToVenue.get(id);
    if (v) {
      ordered.push(v);
      idToVenue.delete(id);
    }
  });
  // append any new venues not in order yet
  idToVenue.forEach(v => ordered.push(v));
  venues.value = ordered;
};

onMounted(() => {
  try {
    const raw = localStorage.getItem('pickleball_admin_order');
    adminOrder.value = raw ? JSON.parse(raw) : [];
  } catch {
    adminOrder.value = [];
  }
});

const handleDragStart = (id: number) => {
  if (!isSortEditing.value) return;
  draggedVenueId.value = id;
};

const reorderDraft = (newOrder: number[]) => {
  draftAdminOrder.value = newOrder;
};

const handleDrop = async (targetId: number) => {
  if (!isSortEditing.value) return;
  if (draggedVenueId.value === null || draggedVenueId.value === targetId) return;
  const currentOrder = draftAdminOrder.value.length ? [...draftAdminOrder.value] : getBaseAdminOrder();
  const fromIndex = currentOrder.indexOf(draggedVenueId.value);
  const toIndex = currentOrder.indexOf(targetId);
  if (fromIndex === -1 || toIndex === -1) return;

  const [moved] = currentOrder.splice(fromIndex, 1);
  currentOrder.splice(toIndex, 0, moved);
  reorderDraft(currentOrder);
  draggedVenueId.value = null;
};

const handleMoveUp = async (id: number) => {
  if (!isSortEditing.value) return;
  const currentOrder = draftAdminOrder.value.length ? [...draftAdminOrder.value] : getBaseAdminOrder();
  const idx = currentOrder.indexOf(id);
  if (idx <= 0) return;
  const next = [...currentOrder];
  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
  reorderDraft(next);
};

const handleMoveDown = async (id: number) => {
  if (!isSortEditing.value) return;
  const currentOrder = draftAdminOrder.value.length ? [...draftAdminOrder.value] : getBaseAdminOrder();
  const idx = currentOrder.indexOf(id);
  if (idx === -1 || idx >= currentOrder.length - 1) return;
  const next = [...currentOrder];
  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
  reorderDraft(next);
};

const startSortEdit = () => {
  isSortEditing.value = true;
  draftAdminOrder.value = getBaseAdminOrder();
  draggedVenueId.value = null;
};

const cancelSortEdit = () => {
  isSortEditing.value = false;
  draftAdminOrder.value = [];
  draggedVenueId.value = null;
};

const saveSortEdit = async () => {
  if (!isSortEditing.value) return;
  const next = draftAdminOrder.value.length ? [...draftAdminOrder.value] : getBaseAdminOrder();
  const sportSlug = adminSportFilter.value;
  const sportId = sportSlug === 'all' ? undefined : sports.value.find((s) => s.slug === sportSlug)?.id;
  if (sportSlug === 'all') {
    adminOrder.value = next;
    saveAdminOrder();
    applyAdminOrder();
  }
  try {
    await db.updateVenueOrder(next, sportId);
  } catch (err) {
    console.error('Failed to persist order:', err);
  } finally {
    cancelSortEdit();
  }
  if (sportSlug !== 'all') await loadData();
};

const handleAddSport = async () => {
  const name_en = newSportName.value.trim();
  if (!name_en) return;
  addSportError.value = null;
  isAddingSport.value = true;
  try {
    const created = await db.createSport({ name_en, name_zh: newSportNameZh.value.trim() || undefined });
    sports.value = [...sports.value, created];
    newSportName.value = '';
    newSportNameZh.value = '';
    showAddSportInput.value = false;
    adminSportFilter.value = created.slug;
  } catch (err: any) {
    addSportError.value = err?.message || 'Failed to add sport.';
  } finally {
    isAddingSport.value = false;
  }
};

const cancelAddSport = () => {
  showAddSportInput.value = false;
  newSportName.value = '';
  newSportNameZh.value = '';
  addSportError.value = null;
};

const updateSportApiCall = async (s: Sport) => {
  try {
    const updated = await db.updateSport(s.id, { name: s.name, name_zh: s.name_zh ?? undefined });
    const idx = sports.value.findIndex((x) => x.id === s.id);
    if (idx !== -1) sports.value = sports.value.map((x, i) => (i === idx ? { ...x, ...updated } : x));
  } catch (err: any) {
    alert(err?.message || 'Failed to update sport');
  }
};

const deleteSportApiCall = async (sportId: number) => {
  if (!confirm(language.value === 'en' ? 'Delete this sport? Venues will lose this tag.' : '刪除此運動？場地將移除此標籤。')) return;
  const slug = sports.value.find((x) => x.id === sportId)?.slug;
  try {
    await db.deleteSport(sportId);
    sports.value = sports.value.filter((x) => x.id !== sportId);
    if (adminSportFilter.value === slug) adminSportFilter.value = 'all';
    isEditingSports.value = false;
  } catch (err: any) {
    alert(err?.message || 'Failed to delete sport');
  }
};
</script>

<template>
  <div :class="['min-h-screen pb-safe transition-colors', darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900']">
    <Header
      :language="language"
      :setLanguage="(l: Language) => { language = l; }"
      :isAdmin="isAnyAdmin"
      :onAdminClick="() => { if (isAnyAdmin) currentTab = 'admin'; else { showAdminLogin = true; syncAdminUrl(true); } }"
      :darkMode="darkMode"
      :setDarkMode="(d: boolean) => { darkMode = d; }"
      :t="t"
      :currentTab="currentTab"
      :setTab="(tab: AppTab) => {
        if (tab === 'admin' && !isAnyAdmin) showAdminLogin = true;
        else currentTab = tab;
        if (tab === 'explore') { router.push('/'); resetSeoToDefault(); selectedVenue = null; showDesktopDetail = false; }
        else { selectedVenue = null; showDesktopDetail = false; }
      }"
      :viewMode="mobileViewMode"
      :setViewMode="(mode: 'map' | 'list') => { mobileViewMode = mode; }"
      :filterSpecialOffer="filterSpecialOffer"
      :setFilterSpecialOffer="(v: boolean) => { filterSpecialOffer = v; }"
      :hideNavTabs="!!selectedVenue && (route.name === 'venue' || showDesktopDetail)"
    />

    <main class="h-full">
      <div
        v-if="currentTab === 'admin' && isAnyAdmin && !selectedVenue"
        class="container mx-auto p-4 md:p-8 pb-32 md:pb-8 space-y-8 animate-in fade-in duration-500"
      >
        <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div class="flex flex-col gap-2">
            <h2 class="text-3xl md:text-4xl font-black tracking-tight">Manage Courts</h2>
            <div v-if="isSuperAdmin" class="flex flex-wrap gap-2 items-center">
              <span class="text-xs font-bold uppercase tracking-wider opacity-60">Sport:</span>
              <button
                type="button"
                class="px-3 py-2 rounded-lg font-bold text-sm transition-all"
                :class="adminSportFilter === 'all' ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')"
                @click="adminSportFilter = 'all'"
              >
                All
              </button>
              <button
                v-for="s in sports"
                :key="s.id"
                type="button"
                class="px-3 py-2 rounded-lg font-bold text-sm transition-all"
                :class="adminSportFilter === s.slug ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')"
                @click="adminSportFilter = s.slug"
              >
                {{ sportDisplayName(s) }}
              </button>
              <template v-if="isSuperAdmin && showAddSportInput">
                <input
                  v-model="newSportName"
                  type="text"
                  class="px-3 py-2 rounded-lg text-sm font-bold border-2 border-[#007a67] focus:outline-none min-w-[100px]"
                  :class="darkMode ? 'bg-gray-800 text-white border-[#007a67]' : 'bg-white text-gray-900'"
                  placeholder="English name"
                  @keydown.enter="handleAddSport"
                  @keydown.escape="cancelAddSport"
                />
                <input
                  v-model="newSportNameZh"
                  type="text"
                  class="px-3 py-2 rounded-lg text-sm font-bold border-2 border-[#007a67] focus:outline-none min-w-[100px]"
                  :class="darkMode ? 'bg-gray-800 text-white border-[#007a67]' : 'bg-white text-gray-900'"
                  placeholder="中文名稱"
                  @keydown.enter="handleAddSport"
                  @keydown.escape="cancelAddSport"
                />
                <button
                  type="button"
                  class="px-3 py-2 rounded-lg text-sm font-bold bg-[#007a67] text-white"
                  :disabled="!newSportName.trim() || isAddingSport"
                  @click="handleAddSport"
                >
                  {{ isAddingSport ? '…' : 'Add' }}
                </button>
                <button
                  type="button"
                  class="px-3 py-2 rounded-lg text-sm font-bold"
                  :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'"
                  @click="cancelAddSport"
                >
                  Cancel
                </button>
              </template>
              <button
                v-else-if="isSuperAdmin"
                type="button"
                class="px-3 py-2 rounded-lg text-sm font-bold border-2 border-dashed"
                :class="darkMode ? 'border-gray-500 text-gray-400 hover:border-[#007a67] hover:text-[#007a67]' : 'border-gray-400 text-gray-500 hover:border-[#007a67] hover:text-[#007a67]'"
                @click="showAddSportInput = true; addSportError = null;"
              >
                + Add sport
              </button>
              <button
                v-if="isSuperAdmin"
                type="button"
                class="px-3 py-2 rounded-lg text-sm font-bold"
                :class="darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
                @click="isEditingSports = !isEditingSports"
              >
                {{ isEditingSports ? 'Hide' : 'Manage Sports' }}
              </button>
            </div>
            <div v-if="isSuperAdmin && isEditingSports" class="grid gap-2 mt-4 p-4 rounded-xl border" :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'">
              <p class="text-xs font-bold uppercase tracking-wider opacity-70">Edit sport names</p>
              <div v-for="s in adminSportsList" :key="s.id" class="flex flex-wrap gap-2 items-center">
                <input v-model="s.name" type="text" class="px-3 py-2 rounded-lg text-sm border max-w-[140px]" :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'" placeholder="Name" />
                <input v-model="s.name_zh" type="text" class="px-3 py-2 rounded-lg text-sm border max-w-[120px]" :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'" placeholder="中文" />
                <button type="button" class="px-3 py-2 rounded-lg text-sm font-bold bg-[#007a67] text-white" @click="updateSportApiCall(s)">Save</button>
                <button type="button" class="px-3 py-2 rounded-lg text-sm font-bold bg-red-500/20 text-red-500" @click="deleteSportApiCall(s.id)">Delete</button>
              </div>
            </div>
            <p v-if="addSportError" class="text-red-500 text-xs font-bold mt-1">{{ addSportError }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="isSuperAdmin && !isSortEditing"
              class="px-4 py-3 md:px-6 md:py-3 bg-gray-500/10 text-gray-700 rounded-lg font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-xs md:text-base"
              :class="darkMode ? 'text-gray-200 bg-gray-700/40' : ''"
              @click="startSortEdit"
            >
              EDIT SORT
            </button>
            <button
              v-else-if="isSuperAdmin"
              class="px-4 py-3 md:px-6 md:py-3 rounded-lg font-black shadow-xl active:scale-95 transition-all text-xs md:text-base"
              :class="isDraftDirty ? 'bg-[#007a67] text-white hover:scale-105' : (darkMode ? 'bg-gray-700 text-gray-400 opacity-60 cursor-not-allowed' : 'bg-gray-200 text-gray-400 opacity-60 cursor-not-allowed')"
              :disabled="!isDraftDirty"
              @click="saveSortEdit"
            >
              SAVE SORT
            </button>
            <button
              v-if="isSuperAdmin && isSortEditing"
              class="px-4 py-3 md:px-6 md:py-3 bg-gray-500/10 text-gray-700 rounded-lg font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-xs md:text-base"
              :class="darkMode ? 'text-gray-200 bg-gray-700/40' : ''"
              @click="cancelSortEdit"
            >
              CANCEL
            </button>
            <button
              v-if="isSuperAdmin && !isSortEditing"
              class="px-4 py-3 md:px-6 md:py-3 bg-[#007a67] text-white rounded-lg font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-xs md:text-base"
              @click="() => { editingVenue = null; showVenueForm = true; }"
            >
              + ADD NEW
            </button>
            <button
              v-if="!isSortEditing"
              class="px-4 py-3 md:px-6 md:py-3 bg-red-500 text-white rounded-lg font-black shadow-xl hover:scale-105 active:scale-95 transition-all text-xs md:text-base"
              @click="() => { adminStatus = { type: 'none', allowedIds: [] }; currentTab = 'explore'; }"
            >
              LOGOUT
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(v, index) in adminVenues"
            :key="v.id"
            class="p-4 border rounded-3xl shadow-md flex items-center justify-between group transition-all hover:shadow-xl gap-2"
            :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'"
            :draggable="isSuperAdmin && isSortEditing"
            @dragstart="handleDragStart(v.id)"
            @dragover.prevent
            @drop="handleDrop(v.id)"
          >
            <div v-if="isSuperAdmin" class="flex items-center gap-2 flex-shrink-0">
              <div class="flex flex-col items-center gap-0.5">
                <button
                  type="button"
                  class="p-2 rounded-lg transition-colors touch-manipulation"
                  :class="!isSortEditing ? 'opacity-30 cursor-not-allowed' : (displayIndexById.get(v.id) === 0 ? 'opacity-30 cursor-not-allowed' : (darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'))"
                  :disabled="!isSortEditing || displayIndexById.get(v.id) === 0"
                  :aria-label="language === 'en' ? 'Move up' : '上移'"
                  @click.stop="handleMoveUp(v.id)"
                >
                  ▲
                </button>
                <span
                  class="text-sm font-black tabular-nums min-w-[1.25rem] text-center"
                  :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
                >
                  {{ (displayIndexById.get(v.id) ?? index) + 1 }}
                </span>
                <button
                  type="button"
                  class="p-2 rounded-lg transition-colors touch-manipulation"
                  :class="!isSortEditing ? 'opacity-30 cursor-not-allowed' : ((displayIndexById.get(v.id) ?? index) === adminVenues.length - 1 ? 'opacity-30 cursor-not-allowed' : (darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-600'))"
                  :disabled="!isSortEditing || (displayIndexById.get(v.id) ?? index) === adminVenues.length - 1"
                  :aria-label="language === 'en' ? 'Move down' : '下移'"
                  @click.stop="handleMoveDown(v.id)"
                >
                  ▼
                </button>
              </div>
            </div>
            <div class="flex items-center gap-4 min-w-0 flex-1">
              <div class="w-16 h-16 rounded-xl overflow-hidden shadow-inner flex-shrink-0">
                <img :src="v.org_icon || v.images[0] || '/placeholder.svg'" class="w-full h-full object-cover" alt="" />
              </div>
              <div class="min-w-0">
                <p class="font-black truncate">{{ v.name }}</p>
                <p class="text-[10px] font-bold opacity-50 uppercase tracking-widest">
                  ${{ v.startingPrice }}/HR
                </p>
              </div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button
                class="p-3 bg-blue-500/10 text-blue-500 rounded-xl"
                @click="() => { editingVenue = v; showVenueForm = true; }"
              >
                ✏️
              </button>
              <button
                v-if="isSuperAdmin"
                class="p-3 bg-red-500/10 text-red-500 rounded-xl"
                @click.stop="() => { venueToDelete = v; }"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col flex-1 min-h-0">
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

        <MobileView
          v-else-if="isMobile"
          :mode="mobileViewMode"
          :setMode="(m: 'map' | 'list') => { mobileViewMode = m; }"
          :venues="filteredVenues"
          :selectedVenue="selectedVenue"
          :onSelectVenue="(v: Venue | null) => { selectedVenue = v; }"
          :searchQuery="searchQuery"
          :setSearchQuery="(s: string) => { searchQuery = s; }"
          :mtrFilter="mtrFilter"
          :setMtrFilter="(arr: string[]) => { mtrFilter = arr; }"
          :distanceFilter="distanceFilter"
          :setDistanceFilter="(s: string) => { distanceFilter = s; }"
          :language="language"
          :t="t"
          :darkMode="darkMode"
          :savedVenues="savedVenues"
          :toggleSave="toggleSaveVenue"
          :isAdmin="isAnyAdmin"
          :canEditVenue="canEditVenue"
          :onEditVenue="(id: number, v: any) => { editingVenue = v; showVenueForm = true; }"
          :availableStations="availableStations"
          :onClearFilters="clearFilters"
          :sportFilter="sportFilter"
          :setSportFilter="(arr: string[]) => { sportFilter = arr; }"
          :sports="sports"
          :filterSpecialOffer="filterSpecialOffer"
          :setFilterSpecialOffer="(v: boolean) => { filterSpecialOffer = v; }"
          :onOpenDetail="() => { if (selectedVenue) router.push('/venues/' + useVenueSlug(selectedVenue)); }"
          :onBackFromDetail="() => { resetSeoToDefault(); router.push('/'); }"
          :force-show-detail="route.name === 'venue' && !!selectedVenue"
        />

        <VenueDetail
          v-else-if="showDesktopDetail && selectedVenue"
          :venue="selectedVenue"
          :onBack="() => { resetSeoToDefault(); selectedVenue = null; showDesktopDetail = false; router.push('/'); }"
          :language="language"
          :t="t"
          :darkMode="darkMode"
          :savedVenues="savedVenues"
          :toggleSave="toggleSaveVenue"
          :isAdmin="isAnyAdmin"
          :onEdit="() => { editingVenue = selectedVenue; showVenueForm = true; }"
        />

        <DesktopView
          v-else
          :venues="filteredVenues"
          :listVenues="listVenues"
          :onShowVenuesAtLocation="showVenuesAtLocation"
          :selectedVenue="selectedVenue"
          :onSelectVenue="(v: Venue | null) => { selectedVenue = v; }"
          :onViewDetail="(v: Venue) => { selectedVenue = v; showDesktopDetail = true; router.push('/venues/' + useVenueSlug(v)); }"
          :searchQuery="searchQuery"
          :setSearchQuery="(s: string) => { searchQuery = s; }"
          :mtrFilter="mtrFilter"
          :setMtrFilter="(arr: string[]) => { mtrFilter = arr; }"
          :distanceFilter="distanceFilter"
          :setDistanceFilter="(s: string) => { distanceFilter = s; }"
          :language="language"
          :t="t"
          :darkMode="darkMode"
          :savedVenues="savedVenues"
          :toggleSave="toggleSaveVenue"
          :isAdmin="isAnyAdmin"
          :canEditVenue="canEditVenue"
          :onAddVenue="() => { editingVenue = null; showVenueForm = true; }"
          :onEditVenue="(id: number, v: any) => { editingVenue = v; showVenueForm = true; }"
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
          :currentTab="currentTab"
          :setTab="(t: AppTab) => { currentTab = t; }"
        />
      </div>
    </main>

    <AdminLogin
      v-if="showAdminLogin"
      :password="adminPassword"
      :setPassword="(val: string) => { adminPassword = val; }"
      :onLogin="handleAdminLogin"
      :onClose="() => { showAdminLogin = false; syncAdminUrl(false); }"
      :language="language"
      :t="t"
      :darkMode="darkMode"
    />

    <VenueForm
      v-if="showVenueForm"
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

    <!-- <MobileNav
      v-if="isMobile"
      :currentTab="currentTab"
      :setTab="(t: AppTab) => { currentTab = t; }"
      :t="t"
      :darkMode="darkMode"
      :isAdmin="isAnyAdmin"
      :onAdminClick="() => { if (isAnyAdmin) currentTab = 'admin'; else { showAdminLogin = true; syncAdminUrl(true); } }"
    /> -->
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
