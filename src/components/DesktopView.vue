<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, nextTick } from 'vue';
import type { Venue, Language, AppTab } from '../../types';
import { getStationDisplayName } from '../utils/mtrStations';
import CourtCard from './CourtCard.vue';

const props = defineProps<{
  venues: Venue[];
  selectedVenue: Venue | null;
  onSelectVenue: (v: Venue | null) => void;
  onViewDetail: (v: Venue) => void;
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
  onAddVenue: () => void;
  onEditVenue: (id: number, v: any) => void;
  onDeleteVenue: (id: number) => void;
  availableStations: string[];
  onClearFilters?: () => void;
  sportFilter: string[];
  setSportFilter: (arr: string[]) => void;
  sports: { id: number; name: string; name_zh?: string | null; slug: string }[];
  currentTab: AppTab;
  setTab: (t: AppTab) => void;
  setFilterSpecialOffer?: (v: boolean) => void;
  filterSpecialOffer?: boolean;
  filterSavedOnly?: boolean;
  setFilterSavedOnly?: (v: boolean) => void;
  /** When set (e.g. after clicking a pin), list shows only these venues. */
  listVenues?: Venue[] | null;
  onShowVenuesAtLocation?: (venues: Venue[]) => void;
  /** True when list is currently filtered to a single location (after clicking a pin). */
  hasLocationFilter?: boolean;
  /** Clears the location filter so the full list can show again. */
  onClearLocationFilter?: () => void;
}>();

const MapView = defineAsyncComponent(() => import('./MapView.vue'));

const showFilterPanel = ref(false);
const showMtrDropdown = ref(false);
const showSportDropdown = ref(false);
const showDistanceDropdown = ref(false);
const mtrSearchQuery = ref('');
const draftMtrFilter = ref<string[]>([]);
const draftSportFilter = ref<string[]>([]);
const mapViewRef = ref<{ clearPins?: () => void; syncPins?: () => void; resetView?: () => void } | null>(null);
const locationVenues = ref<Venue[] | null>(null);

const showLocationPicker = computed(() =>
  Array.isArray(locationVenues.value)
  && locationVenues.value.length > 1
  && !props.selectedVenue
);

const locationVenueIconSrc = (venue: Venue) => {
  const v: any = venue as any;
  return v.org_icon || v.orgIcon || venue.images?.[0] || '/placeholder.svg';
};

const handleShowVenuesAtLocation = (venues: Venue[]) => {
  locationVenues.value = Array.isArray(venues) ? venues : null;
  props.onShowVenuesAtLocation?.(venues);
};

const pickVenueFromLocation = (v: Venue) => {
  locationVenues.value = null;
  props.onSelectVenue(v);
};

watch(
  () => props.selectedVenue?.id ?? null,
  (id) => {
    if (id != null) locationVenues.value = null;
  }
);

watch(
  () => showFilterPanel.value,
  (open) => {
    if (open) {
      draftMtrFilter.value = [...props.mtrFilter];
      draftSportFilter.value = [...props.sportFilter];
      mtrSearchQuery.value = '';
      showMtrDropdown.value = false;
      showSportDropdown.value = false;
      showDistanceDropdown.value = false;
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

const selectedDistanceLabel = computed(() => {
  if (props.distanceFilter === '5') return props.t('mtrUnder5Min');
  if (props.distanceFilter === '10') return props.t('mtrUnder10Min');
  return null;
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

const selectDistance = (value: '5' | '10') => {
  props.setDistanceFilter(value);
  showDistanceDropdown.value = false;
};

const clearDistanceSelection = () => {
  props.setDistanceFilter('');
  showDistanceDropdown.value = false;
};

const leftListVenues = computed(() =>
  props.selectedVenue ? [props.selectedVenue] : (props.listVenues ?? props.venues)
);
</script>

<template>
  <div class="flex h-[calc(100vh-64px)] overflow-hidden">
    <div class="w-[400px] xl:w-[450px] flex-shrink-0 border-r transition-colors flex flex-col"
      :class="darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'">
      <div class="p-6 space-y-4 shadow-sm z-10" :class="darkMode ? 'bg-gray-800' : 'bg-white'">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-[900] uppercase tracking-wider opacity-70"
            :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
          </span>
          <!--<button
            v-if="onClearFilters && (mtrFilter.length > 0 || distanceFilter || sportFilter.length > 0)"
            type="button"
            class="text-[11px] font-bold opacity-70 hover:opacity-100 transition-opacity rounded-[999px] px-3 py-1.5"
            :class="darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'"
            @click="onClearFilters()"
          >
            {{ t('clearFilters') }}
          </button>-->
        </div>
        <div class="relative flex items-center gap-2">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 text-[#007a67] z-10">🔍</span>
          <input type="text" :value="searchQuery" :placeholder="t('search')"
            class="flex-1 pl-10 pr-12 py-3 border rounded-[12px] focus:ring-2 focus:ring-[#007a67] focus:outline-none transition-all"
            :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'"
            @input="e => setSearchQuery((e.target as HTMLInputElement).value)" />
          <button type="button" class="absolute right-2 p-2 rounded-[8px] transition-all"
            :class="showFilterPanel ? 'bg-[#007a67] text-white' : (darkMode ? 'text-gray-400 hover:bg-gray-600' : 'text-gray-500 hover:bg-gray-200')"
            @click="showFilterPanel = !showFilterPanel">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>
        <!-- Filter chips row -->
        <div class="flex flex-wrap gap-2 items-center">
          <div class="relative">
            <button type="button"
              class="inline-flex items-center gap-1.5 rounded-[999px] px-3 py-2 text-[12px] font-bold transition-all"
              :class="selectedSport ? 'bg-[#007a67] text-white shadow-sm' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
              @click="showSportDropdown = !showSportDropdown; showDistanceDropdown = false">
              <span>{{ selectedSportLabel || t('sportType') }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 opacity-80 transition-transform"
                :class="showSportDropdown ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-if="showSportDropdown"
              class="absolute top-full left-0 mt-1 p-2 rounded-[8px] border shadow-lg z-20 min-w-[220px] max-h-[220px] flex flex-col"
              :class="darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'">
              <div class="max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar pr-1 flex-1 min-h-0">
                <button v-for="s in sports" :key="s.id" type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] text-left text-[12px] font-bold transition-all"
                  :class="sportFilter.includes(s.slug)
                    ? 'bg-[#007a67] text-white'
                    : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
                  @click.stop="selectSport(s.slug)">
                  <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                    :class="sportFilter.includes(s.slug) ? 'bg-white border-white' : (darkMode ? 'border-gray-500' : 'border-gray-300')">
                    <svg v-if="sportFilter.includes(s.slug)" xmlns="http://www.w3.org/2000/svg"
                      class="w-3 h-3 text-[#007a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span class="flex-1">{{ language === 'zh' && s.name_zh ? s.name_zh : s.name }}</span>
                </button>
              </div>
            </div>
          </div>
          <template v-for="station in mtrFilter" :key="station">
            <span
              class="inline-flex items-center gap-1.5 rounded-[999px] pl-3 pr-1.5 py-2 text-[12px] font-bold bg-[#007a67] text-white shadow-sm">
              {{ getStationDisplayName(station, language) }}
              <button type="button"
                class="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/20 text-[14px] leading-none"
                @click="setMtrFilter(mtrFilter.filter(s => s !== station))">
                ×
              </button>
            </span>
          </template>
          <div class="relative">
            <button type="button"
              class="inline-flex items-center gap-1.5 rounded-[999px] px-3 py-2 text-[12px] font-bold transition-all"
              :class="distanceFilter ? 'bg-[#007a67] text-white shadow-sm' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
              @click="showDistanceDropdown = !showDistanceDropdown; showSportDropdown = false">
              <span>{{ selectedDistanceLabel || t('walkingDistance') }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 opacity-80 transition-transform"
                :class="showDistanceDropdown ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-if="showDistanceDropdown"
              class="absolute top-full left-0 mt-1 p-2 rounded-[8px] border shadow-lg z-20 min-w-[200px] flex flex-col"
              :class="darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'">
              <div class="space-y-1">
                <button type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] text-left text-[12px] font-bold transition-all"
                  :class="distanceFilter === '5'
                    ? 'bg-[#007a67] text-white'
                    : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
                  @click.stop="selectDistance('5')">
                  <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                    :class="distanceFilter === '5' ? 'bg-white border-white' : (darkMode ? 'border-gray-500' : 'border-gray-300')">
                    <svg v-if="distanceFilter === '5'" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-[#007a67]"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span class="flex-1">{{ t('mtrUnder5Min') }}</span>
                </button>
                <button type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] text-left text-[12px] font-bold transition-all"
                  :class="distanceFilter === '10'
                    ? 'bg-[#007a67] text-white'
                    : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
                  @click.stop="selectDistance('10')">
                  <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                    :class="distanceFilter === '10' ? 'bg-white border-white' : (darkMode ? 'border-gray-500' : 'border-gray-300')">
                    <svg v-if="distanceFilter === '10'" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-[#007a67]"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span class="flex-1">{{ t('mtrUnder10Min') }}</span>
                </button>
              </div>
              <button type="button"
                class="flex-shrink-0 mt-2 w-full px-3 py-2 text-[11px] font-bold rounded-[8px]"
                :class="darkMode ? 'text-gray-300 bg-gray-800 hover:bg-gray-700' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
                @click.stop="clearDistanceSelection">
                {{ t('clearAll') }}
              </button>
            </div>
          </div>
          <button v-if="setFilterSpecialOffer" type="button"
            class="inline-flex items-center gap-1.5 rounded-[999px] px-3 py-2 text-[12px] font-bold transition-all"
            :class="filterSpecialOffer ? 'bg-[#007a67] text-white shadow-sm' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
            :title="t('specialOffer')" @click="setFilterSpecialOffer(!filterSpecialOffer)">
            {{ t('specialOffer') }}
          </button>
          <button type="button"
            class="inline-flex items-center gap-1.5 rounded-[999px] px-3 py-2 text-[12px] font-bold transition-all"
            :class="filterSavedOnly ? 'bg-[#007a67] text-white shadow-sm' : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
            :title="t('saved')" @click="setFilterSavedOnly(!filterSavedOnly)">
            {{ t('saved') }}
          </button>
        </div>
        <!-- Filter Panel -->
        <div v-if="showFilterPanel"
          class="mt-4 p-4 rounded-[12px] border space-y-3 animate-in slide-in-from-top duration-200"
          :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'">
          <div class="flex items-center justify-between">
            <span class="text-[13px] font-bold" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">{{ t('filter')
              }}</span>
            <!--<button
              type="button"
              class="text-[11px] font-bold px-3 py-1 rounded-[999px] border border-transparent hover:border-gray-400 transition-colors"
              :class="darkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'"
              @click="async () => { await mapViewRef?.clearPins?.(); setMtrFilter([...draftMtrFilter]); setSportFilter([...draftSportFilter]); showFilterPanel = false; showMtrDropdown = false; showSportDropdown = false; mtrSearchQuery = ''; await nextTick(); mapViewRef?.syncPins?.(); }"
            >
              {{ language === 'en' ? 'Go search' : '開始搜尋' }}
            </button>-->
          </div>
          <!-- MTR Station dropdown: trigger shows label only, items drop down -->
          <div class="relative">
            <button type="button"
              class="w-full flex items-center justify-between px-3 py-2.5 text-[12px] font-bold rounded-[8px] border transition-colors"
              :class="darkMode ? 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="showMtrDropdown = !showMtrDropdown">
              <span>{{ t('mtrStation') }}</span>
              <span v-if="draftMtrFilter.length > 0" class="text-[11px] opacity-80">({{ draftMtrFilter.length }})</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-70 transition-transform"
                :class="showMtrDropdown ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-if="showMtrDropdown"
              class="absolute top-full left-0 right-0 mt-1 p-2 rounded-[8px] border shadow-lg z-20 max-h-[220px] flex flex-col"
              :class="darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'">
              <div class="relative flex-shrink-0 mb-2">
                <span class="absolute left-2 top-1/2 -translate-y-1/2 opacity-50 text-xs">🔍</span>
                <input type="text" v-model="mtrSearchQuery"
                  :placeholder="language === 'en' ? 'Search stations...' : '搜尋車站...'"
                  class="w-full pl-7 pr-3 py-2 text-[12px] border rounded-[8px] focus:ring-2 focus:ring-[#007a67] focus:outline-none"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-700'"
                  @click.stop />
              </div>
              <div class="max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar pr-1 flex-1 min-h-0">
                <button v-for="station in filteredStations" :key="station" type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] text-left text-[12px] font-bold transition-all"
                  :class="draftMtrFilter.includes(station)
                    ? 'bg-[#007a67] text-white'
                    : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')"
                  @click.stop="toggleMtrStation(station)">
                  <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                    :class="draftMtrFilter.includes(station) ? 'bg-white border-white' : (darkMode ? 'border-gray-500' : 'border-gray-300')">
                    <svg v-if="draftMtrFilter.includes(station)" xmlns="http://www.w3.org/2000/svg"
                      class="w-3 h-3 text-[#007a67]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span class="flex-1">{{ getStationDisplayName(station, language) }}</span>
                </button>
              </div>
              <button type="button" class="flex-shrink-0 mt-2 w-full px-3 py-2 text-[12px] font-bold rounded-[8px]"
                :class="darkMode ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
                @click.stop="draftMtrFilter = []; setMtrFilter([]); mtrSearchQuery = ''">
                {{ t('clearAll') }}
              </button>
            </div>
          </div>
          <div class="flex gap-2 pt-2 border-t" :class="darkMode ? 'border-gray-600' : 'border-gray-200'">
            <button v-if="onClearFilters" type="button"
              class="flex-1 px-3 py-2 text-[12px] font-bold rounded-[8px] transition-opacity"
              :class="darkMode ? 'text-gray-300 bg-gray-800 hover:bg-gray-700' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
              @click="onClearFilters(); draftMtrFilter = []; draftSportFilter = []; showFilterPanel = false; showMtrDropdown = false; showSportDropdown = false; mtrSearchQuery = ''">
              {{ t('clearFilters') }}
            </button>
            <button type="button" class="flex-1 px-3 py-2 text-[12px] font-bold rounded-[8px] transition-opacity"
              :class="darkMode ? 'text-gray-300 bg-gray-800 hover:bg-gray-700' : 'text-gray-600 bg-gray-200 hover:bg-gray-300'"
              @click="async () => { await mapViewRef?.clearPins?.(); setMtrFilter([...draftMtrFilter]); setSportFilter([...draftSportFilter]); showFilterPanel = false; showMtrDropdown = false; showSportDropdown = false; mtrSearchQuery = ''; await nextTick(); mapViewRef?.syncPins?.(); }">
              {{ language === 'en' ? 'Go search' : '開始搜尋' }}
            </button>
          </div>
        </div>
        <button v-if="isAdmin" class="w-full px-4 py-3 bg-[#007a67] text-white rounded-[8px] font-bold shadow-lg"
          @click="onAddVenue">
          ✨ {{ t('addVenue') }}
        </button>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <button v-if="selectedVenue || hasLocationFilter" type="button"
          class="w-full mb-2 py-2 text-sm font-bold rounded-[8px] transition-colors"
          :class="darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200'"
          @click="async () => { onClearLocationFilter?.(); onSelectVenue(null); await nextTick(); mapViewRef?.resetView?.(); }">
          ← {{ language === 'en' ? 'Show all courts' : '顯示全部場地' }}
        </button>
        <div v-if="leftListVenues.length === 0" class="text-center py-20 space-y-4">
          <div class="text-6xl opacity-20">🏸</div>
          <p class="text-lg font-bold" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            {{ t('noVenues') }}
          </p>
        </div>
        <template v-else>
          <CourtCard v-for="venue in leftListVenues" :key="venue.id" :venue="venue"
            :onClick="() => onSelectVenue(venue)" :onViewDetail="() => onViewDetail(venue)" :language="language" :t="t"
            :darkMode="darkMode" :isSaved="savedVenues.includes(venue.id)" :onToggleSave="() => toggleSave(venue.id)" />
        </template>
      </div>

      <!-- <div class="flex-shrink-0 p-4 border-t"
        :class="darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'">
        <button type="button"
          class="w-full flex items-center justify-center gap-2 py-3 rounded-[8px] text-[14px] font-bold transition-all"
          :class="currentTab === 'saved'
            ? 'bg-red-500/15 text-red-500'
            : (darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200')"
          @click="setTab(currentTab === 'saved' ? 'explore' : 'saved')">
          <span>❤️</span>
          <span>{{ t('saved') }}</span>
        </button>
      </div> -->
    </div>

    <div class="flex-1 relative">
      <MapView ref="mapViewRef" :venues="props.venues" :selectedVenue="selectedVenue"
        :onSelectVenue="(v: Venue | null) => onSelectVenue(v)" :onShowVenuesAtLocation="handleShowVenuesAtLocation"
        :language="language" :darkMode="darkMode" :isMobile="false" />

      <!-- Map pin list (desktop): when a multi-venue pin is clicked, show a chooser panel on top of the map -->
      <div v-if="showLocationPicker" class="absolute top-5 left-5 right-5 z-30 pointer-events-none">
        <div
          class="max-w-[420px] pointer-events-auto rounded-[16px] border shadow-xl overflow-hidden"
          :class="darkMode ? 'bg-gray-900/95 border-gray-800 text-white backdrop-blur' : 'bg-white/95 border-gray-200 text-gray-900 backdrop-blur'"
        >
          <div class="flex items-center justify-between px-4 py-3 border-b"
            :class="darkMode ? 'border-gray-800' : 'border-gray-200'">
            <p class="text-[12px] font-black tracking-wider uppercase opacity-70">
              {{ language === 'en' ? `Venues here (${locationVenues!.length})` : `此位置場地（${locationVenues!.length}）` }}
            </p>
            <button
              type="button"
              class="w-8 h-8 rounded-full flex items-center justify-center text-[18px]"
              :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'"
              @click="locationVenues = null"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div class="max-h-[280px] overflow-y-auto">
            <button
              v-for="v in locationVenues"
              :key="v.id"
              type="button"
              class="w-full flex items-center gap-3 text-left px-4 py-3 font-bold text-[14px] transition-colors"
              :class="darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'"
              @click="pickVenueFromLocation(v)"
            >
              <span class="w-10 h-10 rounded-[12px] overflow-hidden flex-shrink-0"
                :class="darkMode ? 'bg-gray-800' : 'bg-gray-100'">
                <img :src="locationVenueIconSrc(v)" alt="" class="w-full h-full object-cover" loading="lazy" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate">{{ v.name }}</span>
                <span v-if="v.mtrStation" class="block text-[11px] font-semibold opacity-70 truncate">
                  🚇 {{ getStationDisplayName(v.mtrStation, language) }}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
