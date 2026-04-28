<script setup lang="ts">
import { ref, watch, computed, defineAsyncComponent, nextTick } from 'vue';
import type { Venue, Language } from '../../types';
import { getStationDisplayName } from '../utils/mtrStations';
import MobileVenueCard from './MobileVenueCard.vue';
import VenueDetail from './VenueDetail.vue';

const MapView = defineAsyncComponent(() => import('./MapView.vue'));

const showFilterPanel = ref(false);
const showMtrDropdown = ref(false);
const showSportDropdown = ref(false);
const mtrSearchQuery = ref('');
const draftMtrFilter = ref<string[]>([]);
const draftSportFilter = ref<string[]>([]);
const mapViewRef = ref<{ clearPins?: () => void; syncPins?: () => void; resetView?: () => void } | null>(null);

watch(
  () => showFilterPanel.value,
  (open) => {
    if (open) {
      draftMtrFilter.value = [...props.mtrFilter];
      draftSportFilter.value = [...props.sportFilter];
      mtrSearchQuery.value = '';
      showMtrDropdown.value = false;
      showSportDropdown.value = false;
    }
  }
);

const toggleMtrStation = (station: string) => {
  if (draftMtrFilter.value.includes(station)) {
    draftMtrFilter.value = draftMtrFilter.value.filter(s => s !== station);
  } else {
    draftMtrFilter.value = [...draftMtrFilter.value, station];
  }
};

const toggleSport = (slug: string) => {
  if (draftSportFilter.value.includes(slug)) {
    draftSportFilter.value = draftSportFilter.value.filter(s => s !== slug);
  } else {
    draftSportFilter.value = [...draftSportFilter.value, slug];
  }
};

const filteredStations = computed(() => {
  const query = mtrSearchQuery.value.toLowerCase().trim();
  if (!query) return props.availableStations;
  return props.availableStations.filter(station => {
    const displayName = getStationDisplayName(station, props.language).toLowerCase();
    return displayName.includes(query) || station.toLowerCase().includes(query);
  });
});

const selectedSport = computed(() => {
  const slug = props.sportFilter[0];
  if (!slug) return null;
  return props.sports.find((s) => s.slug === slug) ?? null;
});

const selectedSportLabel = computed(() => {
  const s = selectedSport.value;
  if (!s) return null;
  return props.language === 'zh' && s.name_zh ? s.name_zh : s.name;
});

const selectSport = (slug: string) => {
  props.setSportFilter([slug]);
  draftSportFilter.value = [slug];
  showSportDropdown.value = false;
};

const clearSportSelection = () => {
  props.setSportFilter([]);
  draftSportFilter.value = [];
  showSportDropdown.value = false;
};

const props = defineProps<{
  mode: 'map' | 'list';
  setMode: (m: 'map' | 'list') => void;
  venues: Venue[];
  selectedVenue: Venue | null;
  onSelectVenue: (v: Venue | null) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  mtrFilter: string[];
  setMtrFilter: (arr: string[]) => void;
  distanceFilter: string;
  setDistanceFilter: (s: string) => void;
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  savedVenues: number[];
  toggleSave: (id: number) => void;
  isAdmin: boolean;
  canEditVenue: (venueId: number) => boolean;
  onEditVenue: (id: number, v: any) => void;
  availableStations: string[];
  onClearFilters?: () => void;
  sportFilter: string[];
  setSportFilter: (arr: string[]) => void;
  sports: { id: number; name: string; name_zh?: string | null; slug: string }[];
  /** Pass the venue so the URL updates even if parent `selectedVenue` is one tick behind. */
  onOpenDetail?: (venue: Venue) => void;
  onBackFromDetail?: () => void;
  /** When true (e.g. landed on /venues/slug), show full detail page. */
  forceShowDetail?: boolean;
  filterSpecialOffer?: boolean;
  setFilterSpecialOffer?: (v: boolean) => void;
  /** When set (e.g. after clicking a pin), list shows only these venues. */
  listVenues?: Venue[] | null;
  onShowVenuesAtLocation?: (venues: Venue[]) => void;
}>();

/** List to show on filter side: when pin clicked, only venues at that location; else all. */
const displayListVenues = computed(() => (props.listVenues != null ? props.listVenues : props.venues));

const showDetailPage = ref(false);

watch(
  // When landing on /venues/:slug, selectedVenue can be null initially (data loads async).
  // Re-run when selectedVenue becomes available so mobile actually shows the detail page.
  () => ({ force: props.forceShowDetail, selectedId: props.selectedVenue?.id ?? null }),
  ({ force, selectedId }) => {
    if (force && selectedId != null) showDetailPage.value = true;
  },
  { immediate: true }
);

const currentIndex = computed(() => {
  if (!props.selectedVenue) return -1;
  return displayListVenues.value.findIndex(v => v.id === props.selectedVenue!.id);
});

const showStickyCard = computed(() => props.mode === 'map' && !!props.selectedVenue);

const hasPrevVenue = computed(() => displayListVenues.value.length > 1 && currentIndex.value >= 0);
const hasNextVenue = computed(() => displayListVenues.value.length > 1 && currentIndex.value >= 0);

const selectInitialVenue = () => {
  if (!props.selectedVenue && displayListVenues.value.length > 0) {
    props.onSelectVenue(displayListVenues.value[0]);
  }
};

watch(
  () => props.mode,
  (val) => {
    if (val === 'map') {
      selectInitialVenue();
    } else if (val === 'list') {
      // If we're on a deep link (/venues/:slug), don't clear the selection/detail state.
      // Otherwise mobile would stay on the list even though the route is a venue detail page.
      if (props.forceShowDetail) return;
      showDetailPage.value = false;
      props.onSelectVenue(null);
    }
  },
  { immediate: true }
);

const goPrevVenue = () => {
  if (displayListVenues.value.length === 0) return;
  const idx = currentIndex.value;
  const prevIndex = idx > 0 ? idx - 1 : displayListVenues.value.length - 1;
  const target = displayListVenues.value[prevIndex];
  if (target) props.onSelectVenue(target);
};

const goNextVenue = () => {
  if (displayListVenues.value.length === 0) return;
  const idx = currentIndex.value;
  const nextIndex = idx >= 0 && idx < displayListVenues.value.length - 1 ? idx + 1 : 0;
  const target = displayListVenues.value[nextIndex];
  if (target) props.onSelectVenue(target);
};

const goPrevVenueFromDetail = async () => {
  const n = displayListVenues.value.length;
  const idx = currentIndex.value;
  if (n === 0 || idx < 0) return;
  const prevIndex = (idx - 1 + n) % n;
  const target = displayListVenues.value[prevIndex];
  if (!target) return;
  props.onSelectVenue(target);
  props.onOpenDetail?.(target);
  await nextTick();
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const goNextVenueFromDetail = async () => {
  const n = displayListVenues.value.length;
  const idx = currentIndex.value;
  if (n === 0 || idx < 0) return;
  const nextIndex = (idx + 1) % n;
  const target = displayListVenues.value[nextIndex];
  if (!target) return;
  props.onSelectVenue(target);
  props.onOpenDetail?.(target);
  await nextTick();
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};
</script>

<template>
  <VenueDetail
    v-if="showDetailPage && selectedVenue"
    :venue="selectedVenue"
    :onBack="() => { showDetailPage = false; props.onBackFromDetail?.(); }"
    :onPrevVenue="goPrevVenueFromDetail"
    :onNextVenue="goNextVenueFromDetail"
    :hasPrevVenue="hasPrevVenue"
    :hasNextVenue="hasNextVenue"
    :language="language"
    :t="t"
    :darkMode="darkMode"
    :savedVenues="savedVenues"
    :toggleSave="toggleSave"
    :isAdmin="isAdmin"
    :canEdit="canEditVenue(selectedVenue.id)"
    :onEdit="() => onEditVenue(selectedVenue!.id, selectedVenue!)"
  />

  <div
    v-else-if="mode === 'map'"
    class="relative h-[calc(100vh-64px)] overflow-hidden"
  >
    <div
      class="absolute top-4 left-4 right-4 z-20 space-y-2 pointer-events-none transition-all duration-300"
    >
      <div class="pointer-events-auto space-y-2">
        <div class="pointer-events-auto flex items-center gap-2">
        <div class="flex-1 relative">
          <input
            type="text"
            :value="searchQuery"
            :placeholder="t('search')"
            class="w-full pl-6 pr-12 py-4 border rounded-[16px] shadow-sm focus:ring-2 focus:ring-[#007a67] focus:outline-none transition-all"
            :class="darkMode ? 'bg-gray-800/90 border-gray-700 text-white backdrop-blur' : 'bg-white/90 border-gray-100 text-gray-900 backdrop-blur'"
            @input="e => setSearchQuery((e.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-[8px] transition-all"
            :class="showFilterPanel ? 'bg-[#007a67] text-white' : (darkMode ? 'text-gray-400' : 'text-gray-500')"
            @click="showFilterPanel = !showFilterPanel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>
        <div
          class="pointer-events-auto flex rounded-[999px] p-0.5 border text-[10px] font-[700]"
          :class="darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white/90 border-gray-200 text-gray-700'"
        >
        <button
            class="px-2 py-1 rounded-[999px]"
            :class="props.mode === 'list' ? 'bg-[#007a67] text-white shadow-sm' : 'opacity-60'"
            @click="props.setMode('list')"
          >
            {{t('list')}}
          </button>
          <button
            class="px-2 py-1 rounded-[999px]"
            :class="props.mode === 'map' ? 'bg-[#007a67] text-white shadow-sm' : 'opacity-60'"
            @click="props.setMode('map')"
          >
            {{t('map')}}
          </button>
          
        </div>
      </div>
      <div class="flex flex-wrap gap-2 pb-2 pointer-events-auto items-center">
        <div class="relative">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-[999px] px-3 py-2 text-[11px] font-bold transition-all shadow-md"
            :class="selectedSport ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white/90 text-gray-700')"
            @click="showSportDropdown = !showSportDropdown"
          >
            <span>{{ selectedSportLabel || t('sportType') }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 opacity-80 transition-transform" :class="showSportDropdown ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            v-if="showSportDropdown"
            class="absolute top-full left-0 mt-1 p-2 rounded-[8px] border shadow-lg z-20 min-w-[220px] max-h-[220px] flex flex-col"
            :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'"
          >
            <div class="max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar pr-1 flex-1 min-h-0">
              <button
                v-for="s in sports"
                :key="s.id"
                type="button"
                class="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-left text-[11px] font-bold transition-all"
                :class="sportFilter.includes(s.slug)
                  ? 'bg-[#007a67] text-white'
                  : (darkMode ? 'bg-gray-900/60 text-gray-200 hover:bg-gray-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
                @click.stop="selectSport(s.slug)"
              >
                <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                  :class="sportFilter.includes(s.slug) ? 'bg-white border-white' : (darkMode ? 'border-gray-500' : 'border-gray-300')"
                >
                  <svg v-if="sportFilter.includes(s.slug)" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-[#007a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="flex-1">{{ language === 'zh' && s.name_zh ? s.name_zh : s.name }}</span>
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex items-center rounded-[999px] px-3 py-2 text-[11px] font-bold transition-all shadow-md"
          :class="distanceFilter === '5' ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white/90 text-gray-700')"
          @click="setDistanceFilter(distanceFilter === '5' ? '' : '5')"
        >
          {{ t('mtrUnder5Min') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center rounded-[999px] px-3 py-2 text-[11px] font-bold transition-all shadow-md"
          :class="distanceFilter === '10' ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white/90 text-gray-700')"
          @click="setDistanceFilter(distanceFilter === '10' ? '' : '10')"
        >
          {{ t('mtrUnder10Min') }}
        </button>
        <button
          v-if="setFilterSpecialOffer"
          type="button"
          class="inline-flex items-center rounded-[999px] px-3 py-2 text-[11px] font-bold transition-all shadow-md"
            :class="filterSpecialOffer ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white/90 text-gray-700')"
            :title="t('specialOffer')"
            @click="setFilterSpecialOffer(!filterSpecialOffer)"
          >
            {{ t('specialOffer') }}
          </button>
        <template v-for="station in mtrFilter" :key="station">
          <span
            class="inline-flex items-center gap-1 rounded-[999px] pl-2.5 pr-1 py-1.5 text-[11px] font-bold bg-[#007a67] text-white shadow-md"
          >
            {{ getStationDisplayName(station, language) }}
            <button
              type="button"
              class="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/20 text-[12px] leading-none"
              @click="setMtrFilter(mtrFilter.filter(s => s !== station))"
            >
              ×
            </button>
          </span>
        </template>
      </div>
      <!-- Filter Panel -->
      <div
        v-if="showFilterPanel"
        class="mt-2 p-3 rounded-[12px] border space-y-3 pointer-events-auto animate-in slide-in-from-top duration-200"
        :class="darkMode ? 'bg-gray-800/95 border-gray-700 backdrop-blur' : 'bg-white/95 border-gray-200 backdrop-blur'"
      >
        <div class="flex items-center justify-between">
          <span class="text-[12px] font-bold" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t('filter') }}</span>
          <button
            type="button"
            class="text-[11px] font-bold px-3 py-1 rounded-[999px] border border-transparent hover:border-gray-400 transition-colors"
            :class="darkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'"
            @click="async () => { await mapViewRef?.clearPins?.(); setMtrFilter([...draftMtrFilter]); setSportFilter([...draftSportFilter]); showFilterPanel = false; showMtrDropdown = false; showSportDropdown = false; mtrSearchQuery = ''; await nextTick(); mapViewRef?.syncPins?.(); }"
          >
            {{ language === 'en' ? 'Go search' : '開始搜尋' }}
          </button>
        </div>
        <!-- MTR Station dropdown: trigger shows label only, items drop down -->
        <div class="relative">
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold rounded-[8px] border transition-colors"
            :class="darkMode ? 'bg-gray-900/60 border-gray-700 text-gray-200 hover:bg-gray-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="showMtrDropdown = !showMtrDropdown"
          >
            <span>{{ t('mtrStation') }}</span>
            <span v-if="draftMtrFilter.length > 0" class="text-[10px] opacity-80">({{ draftMtrFilter.length }})</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 opacity-70 transition-transform" :class="showMtrDropdown ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            v-if="showMtrDropdown"
            class="absolute top-full left-0 right-0 mt-1 p-2 rounded-[8px] border shadow-lg z-20 max-h-[200px] flex flex-col"
            :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'"
          >
            <div class="relative flex-shrink-0 mb-2">
              <span class="absolute left-2 top-1/2 -translate-y-1/2 opacity-50 text-xs">🔍</span>
              <input
                type="text"
                v-model="mtrSearchQuery"
                :placeholder="language === 'en' ? 'Search stations...' : '搜尋車站...'"
                class="w-full pl-7 pr-3 py-2 text-[11px] border rounded-[8px] focus:ring-2 focus:ring-[#007a67] focus:outline-none"
                :class="darkMode ? 'bg-gray-900/60 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-700'"
                @click.stop
              />
            </div>
            <div class="max-h-[140px] overflow-y-auto space-y-1 custom-scrollbar pr-1 flex-1 min-h-0">
              <button
                v-for="station in filteredStations"
                :key="station"
                type="button"
                class="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-left text-[11px] font-bold transition-all"
                :class="draftMtrFilter.includes(station)
                  ? 'bg-[#007a67] text-white'
                  : (darkMode ? 'bg-gray-900/60 text-gray-200 hover:bg-gray-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
                @click.stop="toggleMtrStation(station)"
              >
                <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                  :class="draftMtrFilter.includes(station) ? 'bg-white border-white' : (darkMode ? 'border-gray-500' : 'border-gray-300')"
                >
                  <svg v-if="draftMtrFilter.includes(station)" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-[#007a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="flex-1">{{ getStationDisplayName(station, language) }}</span>
              </button>
            </div>
            <button
              type="button"
              class="flex-shrink-0 mt-2 w-full px-3 py-2 text-[11px] font-bold rounded-[8px]"
              :class="darkMode ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
              @click.stop="setMtrFilter([]); mtrSearchQuery = ''; draftMtrFilter = []"
            >
              {{ t('clearAll') }}
            </button>
          </div>
        </div>
        <!-- Sport type dropdown: multi-select (hidden) -->
        <div class="hidden pt-2 border-t relative" :class="darkMode ? 'border-gray-600' : 'border-gray-200'">
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold rounded-[8px] border transition-colors"
            :class="darkMode ? 'bg-gray-900/60 border-gray-700 text-gray-200 hover:bg-gray-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="showSportDropdown = !showSportDropdown"
          >
            <span>{{ t('sportType') }}</span>
            <span v-if="draftSportFilter.length > 0" class="text-[10px] opacity-80">({{ draftSportFilter.length }})</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 opacity-70 transition-transform" :class="showSportDropdown ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            v-if="showSportDropdown"
            class="absolute top-full left-0 right-0 mt-1 p-2 rounded-[8px] border shadow-lg z-20 max-h-[180px] flex flex-col"
            :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'"
          >
            <div class="max-h-[120px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
              <button
                v-for="s in sports"
                :key="s.id"
                type="button"
                class="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-left text-[11px] font-bold transition-all"
                :class="draftSportFilter.includes(s.slug) ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-900/60 text-gray-200 hover:bg-gray-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
                @click.stop="toggleSport(s.slug)"
              >
                <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                  :class="draftSportFilter.includes(s.slug) ? 'bg-white border-white' : (darkMode ? 'border-gray-500' : 'border-gray-300')"
                >
                  <svg v-if="draftSportFilter.includes(s.slug)" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-[#007a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="flex-1">{{ language === 'zh' && s.name_zh ? s.name_zh : s.name }}</span>
              </button>
            </div>
            <button
              type="button"
              class="flex-shrink-0 mt-2 w-full px-3 py-2 text-[11px] font-bold rounded-[8px]"
              :class="darkMode ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
              @click.stop="draftSportFilter = []"
            >
              {{ t('clearAll') }}
            </button>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            v-if="onClearFilters"
            type="button"
            class="flex-1 px-3 py-2 text-[11px] font-bold rounded-[8px]"
            :class="darkMode ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
            @click="onClearFilters(); draftMtrFilter = []; draftSportFilter = []; showFilterPanel = false; showMtrDropdown = false; showSportDropdown = false; mtrSearchQuery = ''; setFilterSpecialOffer?.(false)"
          >
            {{ t('clearFilters') }}
          </button>
          <button
            type="button"
            class="flex-1 px-3 py-2 text-[11px] font-bold rounded-[8px]"
            :class="darkMode ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
            @click="async () => { await mapViewRef?.clearPins?.(); setMtrFilter([...draftMtrFilter]); setSportFilter([...draftSportFilter]); showFilterPanel = false; showMtrDropdown = false; showSportDropdown = false; mtrSearchQuery = ''; await nextTick(); mapViewRef?.syncPins?.(); }"
          >
            {{ language === 'en' ? 'Go search' : '開始搜尋' }}
          </button>
        </div>
      </div>
    </div>
    </div>

    <MapView
      ref="mapViewRef"
      :venues="props.venues"
      :selectedVenue="selectedVenue"
      :onSelectVenue="(v: Venue) => onSelectVenue(v)"
      :onShowVenuesAtLocation="onShowVenuesAtLocation"
      :language="language"
      :darkMode="darkMode"
      :isMobile="true"
    />

    <div
      v-if="showStickyCard && selectedVenue"
      class="fixed inset-x-0 bottom-20 z-40 pb-safe px-3"
    >
      <div
        class="rounded-[16px] shadow-[0_-10px_30px_rgba(0,0,0,0.25)] border mb-3"
        :class="darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'"
      >
      <div class="flex items-center justify-between px-4 pt-3 pb-1 text-[12px] font-[700] uppercase tracking-widest opacity-60">
        <span>
          {{ language === 'en' ? 'Court' : '球場' }}
          <span v-if="currentIndex >= 0"> {{ currentIndex + 1 }}/{{ venues.length }}</span>
        </span>
        <div class="flex items-center gap-2">
            <button
              class="w-8 h-8 rounded-full flex items-center justify-center text-[16px]"
              :class="darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-500'"
              @click.stop="async () => { onSelectVenue(null); await nextTick(); mapViewRef?.resetView?.(); }"
            >
            ×
          </button>
        </div>
      </div>

        <div class="max-h-[260px] overflow-hidden">
          <MobileVenueCard
            :venue="selectedVenue"
            :language="language"
            :t="t"
            :darkMode="darkMode"
            :isSaved="savedVenues.includes(selectedVenue.id)"
            :onToggleSave="() => toggleSave(selectedVenue!.id)"
            :onViewDetails="() => { showDetailPage = true; if (selectedVenue) props.onOpenDetail?.(selectedVenue); }"
          />
        </div>
        <div class="flex items-center justify-between px-4 pt-3 pb-1 text-[12px] font-[700] uppercase tracking-widest opacity-60">
          <span></span>
          <div class="flex items-center gap-2">
            <button
              class="w-8 h-8 rounded-full flex items-center justify-center text-[16px]"
              :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'"
              @click.stop="goPrevVenue"
            >
              ‹
            </button>
            <button
              class="w-8 h-8 rounded-full flex items-center justify-center text-[16px]"
              :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'"
              @click.stop="goNextVenue"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-else
    class="h-[calc(100vh-64px)] flex flex-col"
  >
    <div
      class="px-4 pt-4 pb-3 space-y-3 border-b"
      :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'"
    >
      <!--<div class="flex items-center justify-between">
        <span class="text-[11px] font-[900] uppercase tracking-wider opacity-70" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">{{ t('filter') }}</span>
        <button
          v-if="onClearFilters && (mtrFilter.length > 0 || distanceFilter || sportFilter.length > 0)"
          type="button"
          class="text-[10px] font-bold opacity-70 hover:opacity-100"
          :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
          @click="onClearFilters()"
        >
          {{ t('clearFilters') }}
        </button>
      </div>-->
      <div class="flex items-center gap-2">
        <div class="flex-1 relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">🔍</span>
          <input
            type="text"
            :value="searchQuery"
            :placeholder="t('search')"
            class="w-full pl-9 pr-12 py-3 border rounded-[12px] focus:ring-2 focus:ring-[#007a67] focus:outline-none transition-all"
            :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'"
            @input="e => setSearchQuery((e.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-[8px] transition-all"
            :class="showFilterPanel ? 'bg-[#007a67] text-white' : (darkMode ? 'text-gray-400' : 'text-gray-500')"
            @click="showFilterPanel = !showFilterPanel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>
        <div
          class="pointer-events-auto flex rounded-[999px] p-0.5 border text-[10px] font-[700]"
          :class="darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white/90 border-gray-200 text-gray-700'"
        >
        <button
            class="px-2 py-1 rounded-[999px]"
            :class="props.mode === 'list' ? 'bg-[#007a67] text-white shadow-sm' : 'opacity-60'"
            @click="props.setMode('list')"
          >
            {{t('list')}}
          </button>
          <button
            class="px-2 py-1 rounded-[999px]"
            :class="props.mode === 'map' ? 'bg-[#007a67] text-white shadow-sm' : 'opacity-60'"
            @click="props.setMode('map')"
          >
            {{t('map')}}
          </button>
          
        </div>
      </div>
      <div class="flex flex-wrap gap-2 items-center">
        <div class="relative">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-[999px] px-3 py-2 text-[12px] font-bold transition-all"
            :class="selectedSport ? 'bg-[#007a67] text-white shadow-sm' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
            @click="showSportDropdown = !showSportDropdown"
          >
            <span>{{ selectedSportLabel || t('sportType') }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 opacity-80 transition-transform" :class="showSportDropdown ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            v-if="showSportDropdown"
            class="absolute top-full left-0 mt-1 p-2 rounded-[8px] border shadow-lg z-20 min-w-[220px] max-h-[220px] flex flex-col"
            :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'"
          >
            <div class="max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar pr-1 flex-1 min-h-0">
              <button
                v-for="s in sports"
                :key="s.id"
                type="button"
                class="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-left text-[11px] font-bold transition-all"
                :class="sportFilter.includes(s.slug)
                  ? 'bg-[#007a67] text-white'
                  : (darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
                @click.stop="selectSport(s.slug)"
              >
                <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                  :class="sportFilter.includes(s.slug) ? 'bg-white border-white' : (darkMode ? 'border-gray-500' : 'border-gray-300')"
                >
                  <svg v-if="sportFilter.includes(s.slug)" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-[#007a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="flex-1">{{ language === 'zh' && s.name_zh ? s.name_zh : s.name }}</span>
              </button>
            </div>
            <button
              type="button"
              class="flex-shrink-0 mt-2 w-full px-3 py-2 text-[11px] font-bold rounded-[8px]"
              :class="darkMode ? 'text-gray-300 bg-gray-800 hover:bg-gray-700' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
              @click.stop="clearSportSelection"
            >
              {{ t('clearAll') }}
            </button>
          </div>
        <button
          type="button"
          class="inline-flex items-center rounded-[999px] px-3 py-2 text-[12px] font-bold transition-all ml-2"
          :class="distanceFilter === '5' ? 'bg-[#007a67] text-white shadow-sm' : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700')"
          @click="setDistanceFilter(distanceFilter === '5' ? '' : '5')"
        >
          {{ t('mtrUnder5Min') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center rounded-[999px] px-3 py-2 text-[12px] font-bold transition-all ml-2"
          :class="distanceFilter === '10' ? 'bg-[#007a67] text-white shadow-sm' : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700')"
          @click="setDistanceFilter(distanceFilter === '10' ? '' : '10')"
        >
          {{ t('mtrUnder10Min') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-[999px] px-3 py-2 text-[12px] font-bold transition-all mt-2"
          :class="filterSpecialOffer ? 'bg-[#007a67] text-white shadow-sm' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
          @click="setFilterSpecialOffer(!filterSpecialOffer)"
        >
          {{ t('specialOffer') }}
        </button>
        </div>
        <template v-for="station in mtrFilter" :key="station">
          <span
            class="inline-flex items-center gap-1 rounded-[999px] pl-3 pr-1.5 py-2 text-[12px] font-bold bg-[#007a67] text-white"
          >
            {{ getStationDisplayName(station, language) }}
            <button
              type="button"
              class="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 text-[14px] leading-none"
              @click="setMtrFilter(mtrFilter.filter(s => s !== station))"
            >
              ×
            </button>
          </span>
        </template>
      </div>
      <!-- Filter Panel -->
      <div
        v-if="showFilterPanel"
        class="mt-2 p-3 rounded-[12px] border space-y-3 animate-in slide-in-from-top duration-200"
        :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'"
      >
        <div class="flex items-center justify-between">
          <span class="text-[12px] font-bold" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t('filter') }}</span>
          <button
            type="button"
            class="text-[11px] font-bold px-3 py-1 rounded-[999px] border border-transparent hover:border-gray-400 transition-colors"
            :class="darkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'"
            @click="() => { setMtrFilter([...draftMtrFilter]); setSportFilter([...draftSportFilter]); showFilterPanel = false; showMtrDropdown = false; showSportDropdown = false; mtrSearchQuery = ''; }"
          >
            {{ language === 'en' ? 'Go search' : '開始搜尋' }}
          </button>
        </div>
        <!-- Special offer toggle: first in list, left of others -->
        <div v-if="setFilterSpecialOffer" class="hidden flex items-center justify-between py-2 border-b" :class="darkMode ? 'border-gray-600' : 'border-gray-200'">
          <span class="text-[12px] font-bold" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t('specialOffer') }}</span>
          <button
            type="button"
            role="switch"
            :aria-checked="filterSpecialOffer"
            class="relative inline-flex h-6 w-10 shrink-0 rounded-full border-2 transition-colors focus:outline-none"
            :class="filterSpecialOffer ? 'bg-[#007a67] border-[#007a67]' : (darkMode ? 'bg-gray-600 border-gray-500' : 'bg-gray-200 border-gray-300')"
            @click="setFilterSpecialOffer(!filterSpecialOffer)"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform"
              :class="filterSpecialOffer ? 'translate-x-4' : 'translate-x-0.5'"
            />
          </button>
        </div>
        <!-- MTR Station dropdown: trigger shows label only, items drop down -->
        <div class="relative">
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold rounded-[8px] border transition-colors"
            :class="darkMode ? 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="showMtrDropdown = !showMtrDropdown"
          >
            <span>{{ t('mtrStation') }}</span>
            <span v-if="draftMtrFilter.length > 0" class="text-[10px] opacity-80">({{ draftMtrFilter.length }})</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 opacity-70 transition-transform" :class="showMtrDropdown ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            v-if="showMtrDropdown"
            class="absolute top-full left-0 right-0 mt-1 p-2 rounded-[8px] border shadow-lg z-20 max-h-[200px] flex flex-col"
            :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'"
          >
            <div class="relative flex-shrink-0 mb-2">
              <span class="absolute left-2 top-1/2 -translate-y-1/2 opacity-50 text-xs">🔍</span>
              <input
                type="text"
                v-model="mtrSearchQuery"
                :placeholder="language === 'en' ? 'Search stations...' : '搜尋車站...'"
                class="w-full pl-7 pr-3 py-2 text-[11px] border rounded-[8px] focus:ring-2 focus:ring-[#007a67] focus:outline-none"
                :class="darkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-700'"
                @click.stop
              />
            </div>
            <div class="max-h-[140px] overflow-y-auto space-y-1 custom-scrollbar pr-1 flex-1 min-h-0">
              <button
                v-for="station in filteredStations"
                :key="station"
                type="button"
                class="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-left text-[11px] font-bold transition-all"
                :class="draftMtrFilter.includes(station)
                  ? 'bg-[#007a67] text-white'
                  : (darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
                @click.stop="toggleMtrStation(station)"
              >
                <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                  :class="draftMtrFilter.includes(station) ? 'bg-white border-white' : (darkMode ? 'border-gray-500' : 'border-gray-300')"
                >
                  <svg v-if="draftMtrFilter.includes(station)" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-[#007a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="flex-1">{{ getStationDisplayName(station, language) }}</span>
              </button>
            </div>
            <button
              type="button"
              class="flex-shrink-0 mt-2 w-full px-3 py-2 text-[11px] font-bold rounded-[8px]"
              :class="darkMode ? 'text-gray-300 bg-gray-800 hover:bg-gray-700' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
              @click.stop="() => { draftMtrFilter = []; setMtrFilter([]); mtrSearchQuery = ''; }"
            >
              {{ t('clearAll') }}
            </button>
          </div>
        </div>
        <!-- Sport type dropdown: multi-select -->
        <div class="hidden pt-2 border-t relative" :class="darkMode ? 'border-gray-600' : 'border-gray-200'">
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-bold rounded-[8px] border transition-colors"
            :class="darkMode ? 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="showSportDropdown = !showSportDropdown"
          >
            <span>{{ t('sportType') }}</span>
            <span v-if="draftSportFilter.length > 0" class="text-[10px] opacity-80">({{ draftSportFilter.length }})</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 opacity-70 transition-transform" :class="showSportDropdown ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            v-if="showSportDropdown"
            class="absolute top-full left-0 right-0 mt-1 p-2 rounded-[8px] border shadow-lg z-20 max-h-[180px] flex flex-col"
            :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'"
          >
            <div class="max-h-[120px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
              <button
                v-for="s in sports"
                :key="s.id"
                type="button"
                class="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-left text-[11px] font-bold transition-all"
                :class="draftSportFilter.includes(s.slug) ? 'bg-[#007a67] text-white' : (darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
                @click.stop="toggleSport(s.slug)"
              >
                <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                  :class="draftSportFilter.includes(s.slug) ? 'bg-white border-white' : (darkMode ? 'border-gray-500' : 'border-gray-300')"
                >
                  <svg v-if="draftSportFilter.includes(s.slug)" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-[#007a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span class="flex-1">{{ language === 'zh' && s.name_zh ? s.name_zh : s.name }}</span>
              </button>
            </div>
            <button
              type="button"
              class="flex-shrink-0 mt-2 w-full px-3 py-2 text-[11px] font-bold rounded-[8px]"
              :class="darkMode ? 'text-gray-300 bg-gray-800 hover:bg-gray-700' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
              @click.stop="draftSportFilter = []"
            >
              {{ t('clearAll') }}
            </button>
          </div>
        </div>
        <div class="flex gap-2 pt-2 border-t" :class="darkMode ? 'border-gray-600' : 'border-gray-200'">
          <button
            v-if="onClearFilters"
            type="button"
            class="flex-1 px-3 py-2 text-[11px] font-bold rounded-[8px]"
            :class="darkMode ? 'text-gray-300 bg-gray-800 hover:bg-gray-700' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
            @click="() => { onClearFilters(); draftMtrFilter = []; draftSportFilter = []; showFilterPanel = false; showMtrDropdown = false; showSportDropdown = false; mtrSearchQuery = ''; setFilterSpecialOffer?.(false); }"
          >
            {{ t('clearFilters') }}
          </button>
          <button
            type="button"
            class="flex-1 px-3 py-2 text-[11px] font-bold rounded-[8px]"
            :class="darkMode ? 'text-gray-300 bg-gray-800 hover:bg-gray-700' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
            @click="() => { setMtrFilter([...draftMtrFilter]); setSportFilter([...draftSportFilter]); showFilterPanel = false; showMtrDropdown = false; showSportDropdown = false; mtrSearchQuery = ''; }"
          >
            {{ language === 'en' ? 'Go search' : '開始搜尋' }}
          </button>
        </div>
      </div>
    </div>

    <div
      class="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4 custom-scrollbar"
      :class="darkMode ? 'bg-gray-900' : 'bg-gray-50'"
    >
      <div
        v-if="displayListVenues.length === 0"
        class="text-center py-16 space-y-3"
      >
        <div class="text-5xl opacity-20">🏸</div>
        <p
          class="text-base font-bold"
          :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
        >
          {{ t('noVenues') }}
        </p>
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <MobileVenueCard
          v-for="venue in venues"
          :key="venue.id"
          :venue="venue"
          :language="language"
          :t="t"
          :darkMode="darkMode"
          :isSaved="savedVenues.includes(venue.id)"
          :onToggleSave="() => toggleSave(venue.id)"
          :onViewDetails="() => {
            onSelectVenue(venue);
            showDetailPage = true;
            props.onOpenDetail?.(venue);
          }"
        />
      </div>
    </div>
  </div>
</template>

