<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Venue, Language, AppTab } from '../../../types';
import LandingHero from './LandingHero.vue';
import CourtCard from '../explore/CourtCard.vue';
import DesktopView from '../explore/DesktopView.vue';
import MobileView from '../explore/MobileView.vue';
import LandingCta from './LandingCta.vue';
import AppFooter from '../layout/AppFooter.vue';
import { countVenuesBySport } from '../../utils/seo';
import { HK_DISTRICTS } from '../../utils/hkDistricts';

type SportOption = { id: number; name: string; name_zh?: string | null; slug: string };

const props = defineProps<{
  venues: Venue[];
  filteredVenues: Venue[];
  listVenues: Venue[];
  sports: SportOption[];
  availableStations: string[];
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  isMobile: boolean;
  savedVenues: number[];
  toggleSave: (id: number) => void;
  selectedVenue: Venue | null;
  onSelectVenue: (v: Venue | null) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  mtrFilter: string[];
  setMtrFilter: (arr: string[]) => void;
  districtFilter: string[];
  setDistrictFilter: (arr: string[]) => void;
  distanceFilter: string;
  setDistanceFilter: (s: string) => void;
  sportFilter: string[];
  setSportFilter: (arr: string[]) => void;
  filterSpecialOffer: boolean;
  setFilterSpecialOffer: (v: boolean) => void;
  filterSavedOnly: boolean;
  setFilterSavedOnly: (v: boolean) => void;
  onClearFilters: () => void;
  onShowVenuesAtLocation: (venues: Venue[]) => void;
  hasLocationFilter: boolean;
  onClearLocationFilter: () => void;
  currentTab: AppTab;
  setTab: (t: AppTab) => void;
  isAdmin: boolean;
  canEditVenue: (venueId: number) => boolean;
  onAddVenue: () => void;
  onEditVenue: (id: number, v: Venue) => void;
  onDeleteVenue: (id: number) => void;
  onViewVenue: (v: Venue) => void;
  onViewDetail: (v: Venue) => void;
  onExplore: (filters?: { mtr?: string; sport?: string; districts?: string[]; specialOffer?: boolean }) => void;
  setLanguage: (l: Language) => void;
}>();

function resolveDefaultHeroSportSlug(sports: SportOption[]): string {
  const indoorPickleball = sports.find((s) => {
    const name = s.name.toLowerCase();
    const slug = s.slug.toLowerCase();
    return (name.includes('pickleball') && name.includes('indoor'))
      || slug.includes('pickleball') && slug.includes('indoor');
  });
  if (indoorPickleball) return indoorPickleball.slug;

  const pickleball = sports.find((s) => s.slug.toLowerCase() === 'pickleball');
  if (pickleball) return pickleball.slug;

  const byId = sports.find((s) => s.id === 1);
  return byId?.slug ?? sports[0]?.slug ?? '';
}

const defaultHeroSportSlug = computed(() => resolveDefaultHeroSportSlug(props.sports));

const districtCount = HK_DISTRICTS.length;

const sportVenueCounts = computed(() => countVenuesBySport(props.venues, props.sports));

const landingSeoIntroText = computed(() =>
  props.t('landingSeoIntro')
    .replace('{{total}}', String(props.venues.length))
    .replace('{{districts}}', String(districtCount))
);

function sportCountLabel(item: { name: string; name_zh?: string | null; count: number }) {
  const name = props.language === 'zh' && item.name_zh ? item.name_zh : item.name;
  return props.t('landingSeoSportItem')
    .replace('{{name}}', name)
    .replace('{{count}}', String(item.count));
}

const heroDistricts = ref<string[]>([]);
const heroSport = ref('');
const embeddedMobileMode = ref<'map' | 'list'>('map');
const partnershipIndex = ref(0);
const DESKTOP_PARTNERSHIP_CARDS_PER_PAGE = 3;

const partnershipVenues = computed(() =>
  props.venues.filter((v) => v.membership_enabled)
);

const visiblePartnershipVenues = computed(() => {
  const venues = partnershipVenues.value;
  const count = Math.min(DESKTOP_PARTNERSHIP_CARDS_PER_PAGE, venues.length);
  if (count === 0) return [];

  const result: Venue[] = [];
  for (let i = 0; i < count; i++) {
    result.push(venues[(partnershipIndex.value + i) % venues.length]);
  }
  return result;
});

const needsPartnershipArrows = computed(
  () => partnershipVenues.value.length > DESKTOP_PARTNERSHIP_CARDS_PER_PAGE
);

watch(
  () => props.sports,
  (sports) => {
    if (!heroSport.value && sports.length > 0) {
      heroSport.value = resolveDefaultHeroSportSlug(sports);
    }
  },
  { immediate: true }
);

watch(
  () => props.districtFilter,
  (districts) => {
    if (districts.length > 0) {
      heroDistricts.value = [...districts];
    }
  },
  { immediate: true }
);

watch(partnershipVenues, (venues) => {
  if (venues.length === 0) {
    partnershipIndex.value = 0;
  } else {
    partnershipIndex.value = partnershipIndex.value % venues.length;
  }
});

function activeHeroSportSlug() {
  return heroSport.value || defaultHeroSportSlug.value;
}

function handleHeroSearch() {
  props.setFilterSpecialOffer(false);
  props.setDistrictFilter([...heroDistricts.value]);
  props.setMtrFilter([]);
  props.setSportFilter([activeHeroSportSlug()]);
  props.onSelectVenue(null);
  props.onExplore({
    districts: heroDistricts.value.length > 0 ? [...heroDistricts.value] : [],
    sport: activeHeroSportSlug(),
    specialOffer: false,
  });
}

function handleViewAllPartnerVenues() {
  props.setFilterSpecialOffer(true);
  props.setDistrictFilter([]);
  props.setMtrFilter([]);
  props.setSportFilter([activeHeroSportSlug()]);
  props.onExplore({
    specialOffer: true,
    sport: activeHeroSportSlug() || props.sportFilter[0],
  });
}

function handleSeeAllCourts() {
  props.setFilterSpecialOffer(false);
  props.setDistrictFilter(heroDistricts.value.length > 0 ? [...heroDistricts.value] : [...props.districtFilter]);
  props.setMtrFilter([]);
  props.setSportFilter([activeHeroSportSlug()]);
  props.onExplore({
    districts: heroDistricts.value.length > 0 ? [...heroDistricts.value] : [...props.districtFilter],
    sport: activeHeroSportSlug() || props.sportFilter[0],
    specialOffer: false,
  });
}

function goPrevPartnership() {
  const len = partnershipVenues.value.length;
  if (len === 0) return;
  partnershipIndex.value = (partnershipIndex.value - 1 + len) % len;
}

function goNextPartnership() {
  const len = partnershipVenues.value.length;
  if (len === 0) return;
  partnershipIndex.value = (partnershipIndex.value + 1) % len;
}
</script>

<template>
  <div class="w-full min-w-0" :class="darkMode ? 'bg-gray-900' : 'bg-white'">
    <LandingHero
      :language="language"
      :t="t"
      :sports="sports"
      :selectedDistricts="heroDistricts"
      :sportSlug="heroSport"
      :defaultSportSlug="defaultHeroSportSlug"
      @update:selectedDistricts="heroDistricts = $event"
      @update:sportSlug="heroSport = $event"
      @search="handleHeroSearch"
    />

    <section class="w-full py-10 md:py-14" :class="darkMode ? 'bg-gray-900' : 'bg-white'">
      <div class="w-full px-4 md:px-6 max-w-7xl mx-auto">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h2
              class="text-2xl md:text-3xl font-black tracking-tight"
              :class="darkMode ? 'text-white' : 'text-gray-900'"
            >
              {{ t('landingPartnershipTitle') }}
            </h2>
            <p
              class="mt-2 text-sm md:text-base"
              :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
            >
              {{ t('landingPartnershipSubtitle') }}
            </p>
          </div>
          <button
            type="button"
            class="text-sm font-bold text-[#007a67] hover:underline shrink-0 self-start sm:self-auto"
            @click="handleViewAllPartnerVenues"
          >
            {{ t('viewAllPartnerVenues') }} →
          </button>
        </div>

        <!-- Mobile: horizontal scroll with desktop-style cards -->
        <div
          v-if="partnershipVenues.length > 0 && isMobile"
          class="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory custom-scrollbar -mx-4 mx-1"
        >
          <div
            v-for="(venue, index) in partnershipVenues"
            :key="venue.id"
            class="snap-start shrink-0 min-w-[345px] max-w-[345px] px-2"
          >
            <CourtCard
              :venue="venue"
              :language="language"
              :t="t"
              :darkMode="darkMode"
              :isMobile="false"
              :isSaved="savedVenues.includes(venue.id)"
              :priorityImage="index === 0"
              :onClick="() => onViewVenue(venue)"
              :onViewDetail="() => onViewVenue(venue)"
              :onToggleSave="() => toggleSave(venue.id)"
            />
          </div>
        </div>

        <!-- Desktop: full-width row (up to 3 cards), loop with arrows when more -->
        <div
          v-else-if="partnershipVenues.length > 0"
          class="flex items-center gap-4 md:gap-6"
        >
          <button
            v-if="needsPartnershipArrows"
            type="button"
            class="w-11 h-11 rounded-full border flex items-center justify-center text-xl font-bold shrink-0 transition-colors"
            :class="darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
            :aria-label="language === 'en' ? 'Previous venue' : '上一個場地'"
            @click="goPrevPartnership"
          >
            ‹
          </button>

          <div class="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CourtCard
              v-for="(venue, index) in visiblePartnershipVenues"
              :key="`${venue.id}-${partnershipIndex}-${index}`"
              :venue="venue"
              :language="language"
              :t="t"
              :darkMode="darkMode"
              :isMobile="false"
              :isSaved="savedVenues.includes(venue.id)"
              :priorityImage="partnershipIndex === 0 && index === 0"
              :onClick="() => onViewVenue(venue)"
              :onViewDetail="() => onViewVenue(venue)"
              :onToggleSave="() => toggleSave(venue.id)"
            />
          </div>

          <button
            v-if="needsPartnershipArrows"
            type="button"
            class="w-11 h-11 rounded-full border flex items-center justify-center text-xl font-bold shrink-0 transition-colors"
            :class="darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
            :aria-label="language === 'en' ? 'Next venue' : '下一個場地'"
            @click="goNextPartnership"
          >
            ›
          </button>
        </div>

        <p
          v-else
          class="text-center py-8 text-sm font-semibold"
          :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
        >
          {{ t('landingNoPartnershipVenues') }}
        </p>
      </div>
    </section>

    <section
      id="explore-section"
      class="w-full py-10 md:py-14"
      :class="darkMode ? 'bg-gray-50 dark:bg-gray-950' : 'bg-gray-50'"
    >
    <div class="w-full px-4 md:px-6 max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 md:mb-8">
      <div>
        <h2
          class="text-2xl md:text-3xl font-black tracking-tight"
          :class="darkMode ? 'text-white' : 'text-gray-900'"
        >
          {{ t('landingMapTitle') }}
        </h2>
        <p
          class="mt-2 text-sm md:text-base"
          :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
        >
          {{ t('landingMapSubtitle') }}
        </p>
        </div>
        <a
          href="/explore"
          class="text-sm font-bold text-[#007a67] hover:underline shrink-0 self-start sm:self-auto no-underline"
          @click.prevent="handleSeeAllCourts"
        >
          {{ t('viewAllVenues') }} →
        </a>
      </div>
      

      <div class="w-full max-w-7xl mx-auto" :class="isMobile ? 'px-0' : 'px-4 md:px-6'">
        <DesktopView
          v-if="!isMobile"
          embedded
          :venues="filteredVenues"
          :listVenues="listVenues"
          :onShowVenuesAtLocation="onShowVenuesAtLocation"
          :hasLocationFilter="hasLocationFilter"
          :onClearLocationFilter="onClearLocationFilter"
          :selectedVenue="selectedVenue"
          :onSelectVenue="onSelectVenue"
          :onViewDetail="onViewDetail"
          :searchQuery="searchQuery"
          :setSearchQuery="setSearchQuery"
          :mtrFilter="mtrFilter"
          :setMtrFilter="setMtrFilter"
          :districtFilter="districtFilter"
          :setDistrictFilter="setDistrictFilter"
          :distanceFilter="distanceFilter"
          :setDistanceFilter="setDistanceFilter"
          :language="language"
          :t="t"
          :darkMode="darkMode"
          :savedVenues="savedVenues"
          :toggleSave="toggleSave"
          :isAdmin="isAdmin"
          :canEditVenue="canEditVenue"
          :onAddVenue="onAddVenue"
          :onEditVenue="onEditVenue"
          :onDeleteVenue="onDeleteVenue"
          :availableStations="availableStations"
          :onClearFilters="onClearFilters"
          :sportFilter="sportFilter"
          :setSportFilter="setSportFilter"
          :sports="sports"
          :filterSpecialOffer="filterSpecialOffer"
          :setFilterSpecialOffer="setFilterSpecialOffer"
          :filterSavedOnly="filterSavedOnly"
          :setFilterSavedOnly="setFilterSavedOnly"
          :currentTab="currentTab"
          :setTab="setTab"
        />

        <MobileView
          v-else
          embedded
          :mode="embeddedMobileMode"
          :setMode="(m: 'map' | 'list') => { embeddedMobileMode = m; }"
          :venues="filteredVenues"
          :listVenues="listVenues"
          :onShowVenuesAtLocation="onShowVenuesAtLocation"
          :selectedVenue="selectedVenue"
          :onSelectVenue="onSelectVenue"
          :searchQuery="searchQuery"
          :setSearchQuery="setSearchQuery"
          :mtrFilter="mtrFilter"
          :setMtrFilter="setMtrFilter"
          :districtFilter="districtFilter"
          :setDistrictFilter="setDistrictFilter"
          :distanceFilter="distanceFilter"
          :setDistanceFilter="setDistanceFilter"
          :language="language"
          :t="t"
          :darkMode="darkMode"
          :savedVenues="savedVenues"
          :toggleSave="toggleSave"
          :isAdmin="isAdmin"
          :canEditVenue="canEditVenue"
          :onEditVenue="onEditVenue"
          :availableStations="availableStations"
          :onClearFilters="onClearFilters"
          :sportFilter="sportFilter"
          :setSportFilter="setSportFilter"
          :sports="sports"
          :filterSpecialOffer="filterSpecialOffer"
          :setFilterSpecialOffer="setFilterSpecialOffer"
          :filterSavedOnly="filterSavedOnly"
          :setFilterSavedOnly="setFilterSavedOnly"
          :currentTab="currentTab"
          :onOpenDetail="onViewVenue"
          :force-show-detail="false"
        />
      </div>
    </section>

    <LandingCta
      :t="t"
      :darkMode="darkMode"
    />

    <section class="sr-only" :aria-label="t('landingSeoHeading')">
      <h2>{{ t('landingSeoHeading') }}</h2>
      <p>{{ landingSeoIntroText }}</p>
      <p>{{ t('landingSeoAllDistricts') }}</p>
      <ul>
        <li v-for="item in sportVenueCounts" :key="item.slug">
          <a :href="`/search/${item.slug}`">{{ sportCountLabel(item) }}</a>
        </li>
      </ul>
    </section>

    <AppFooter
      :language="language"
      :t="t"
      :darkMode="darkMode"
      :setLanguage="setLanguage"
      variant="landing"
    />
  </div>
</template>
