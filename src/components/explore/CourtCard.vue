<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Venue, Language } from '../../../types';
import { getStationDisplayName } from '../../utils/mtrStations';
import { getVenueDistrictSlug, getDistrictDisplayName } from '../../utils/hkDistricts';
import { getVenueImageAlt } from '../../utils/seo';
import { slugify } from '../../utils/slugify';
import { isGcsImageUrl, venueCardImageSrc } from '../../utils/venueImageUrl';

const props = defineProps<{
  venue: Venue;
  onClick: () => void;
  onViewDetail?: () => void;
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  isMobile?: boolean;
  /** First above-the-fold card: eager-load image for LCP. */
  priorityImage?: boolean;
}>();

const isExpanded = ref(false);
const imageAlt = computed(() => getVenueImageAlt(props.venue));
const venueHref = computed(() => `/venues/${slugify(props.venue.name)}`);
const imgFailed = ref(false);
const useProxy = ref(false);
const imageSrc = computed(() => {
  if (imgFailed.value) return '/placeholder.svg';
  const raw = props.venue.images?.[0] || '/placeholder.svg';
  return venueCardImageSrc(raw === '/placeholder.svg' ? raw : raw, useProxy.value, props.isMobile ? 128 : 400);
});

const expandLabel = computed(() => {
  if (isExpanded.value) {
    return props.language === 'en' ? 'Collapse details' : '收起詳情';
  }
  return props.language === 'en' ? 'Expand details' : '展開詳情';
});

const saveLabel = computed(() =>
  props.isSaved ? props.t('saved') : props.t('saveCourt')
);

function onImageError() {
  const raw = props.venue.images?.[0] || '';
  if (!useProxy.value && isGcsImageUrl(raw)) {
    useProxy.value = true;
    return;
  }
  imgFailed.value = true;
}

const districtName = computed(() => {
  const slug = getVenueDistrictSlug(props.venue);
  return slug ? getDistrictDisplayName(slug, props.language) : null;
});

const shareFeedback = ref<string | null>(null);
const handleShare = async () => {
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}${venueHref.value}`
    : '';
  const title = props.venue.name;
  try {
    if (navigator.share) {
      await navigator.share({ title, url, text: title });
    } else {
      await navigator.clipboard.writeText(url);
      shareFeedback.value = props.t('linkCopied');
      setTimeout(() => { shareFeedback.value = null; }, 2000);
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      try {
        await navigator.clipboard.writeText(url);
        shareFeedback.value = props.t('linkCopied');
        setTimeout(() => { shareFeedback.value = null; }, 2000);
      } catch (_) {
        shareFeedback.value = props.language === 'en' ? 'Could not share' : '無法分享';
        setTimeout(() => { shareFeedback.value = null; }, 2000);
      }
    }
  }
};

const toggleExpand = (e: MouseEvent) => {
  e.stopPropagation();
  isExpanded.value = !isExpanded.value;
};

/** Keep SPA navigation, but preserve real href for crawlers / open-in-new-tab. */
function navigateVenue(e: MouseEvent, preferDetail = true) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  if (preferDetail && props.onViewDetail) props.onViewDetail();
  else props.onClick();
}
</script>

<template>
  <div v-if="isMobile" class="w-full min-w-0">
    <div
      class="w-full border rounded-[16px] overflow-hidden mb-4 transition-all duration-300 shadow-sm"
      :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'"
    >
      <div class="flex items-center p-4 gap-4">
        <a
          :href="venueHref"
          class="flex items-center gap-4 flex-1 min-w-0 cursor-pointer no-underline"
          @click="navigateVenue($event, false)"
        >
          <div class="relative w-16 h-16 aspect-square rounded-[16px] overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
            <img
              :src="imageSrc"
              class="w-full h-full object-cover"
              :alt="imageAlt"
              width="64"
              height="64"
              :loading="priorityImage ? 'eager' : 'lazy'"
              :fetchpriority="priorityImage ? 'high' : undefined"
              @error="onImageError"
            />
            <span v-if="venue.membership_enabled" class="absolute top-0 left-0 rounded-br-md px-1.5 py-0.5 text-[12px] font-bold text-white bg-[#007a67] shadow-sm" :title="t('specialOffer')">
              {{ t('specialOffer') }}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <h3
              class="font-[900] text-[24px] leading-tight truncate"
              :class="darkMode ? 'text-white' : 'text-gray-900'"
            >
              {{ venue.name }}
            </h3>
            <p
              v-if="venue.mtrStation || venue.walkingDistance > 0"
              class="text-[14px] font-[400]"
              :class="darkMode ? 'text-gray-300' : 'text-gray-600'"
            >
              <template v-if="venue.mtrStation">🚇 {{ getStationDisplayName(venue.mtrStation, language) }} </template><template v-if="venue.mtrStation && venue.walkingDistance > 0"> • </template><template v-if="venue.walkingDistance > 0"> {{ venue.walkingDistance }} {{ t('min') }}</template>
            </p>
          </div>
        </a>
        <button
          type="button"
          class="p-2 rounded-full transition-transform shrink-0"
          :class="[isExpanded ? 'rotate-180' : '', darkMode ? 'bg-gray-700' : 'bg-gray-50']"
          :aria-label="expandLabel"
          :aria-expanded="isExpanded"
          @click="toggleExpand"
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>

      <div
        v-if="isExpanded"
        class="px-4 pb-4 animate-in slide-in-from-top duration-200"
      >
        <div
          class="flex items-center gap-3 text-[12px] font-[400] mb-3"
          :class="darkMode ? 'text-gray-300' : 'text-gray-600'"
        >
          <span>📍 {{ districtName }}</span>
          <span>🚶 <template v-if="venue.mtrStation && venue.walkingDistance > 0"> • </template><template v-if="venue.walkingDistance > 0"> {{ venue.walkingDistance }} {{ t('min') }}</template></span>
          <span>⬆️ {{ venue.ceilingHeight }}m</span>
          <span class="ml-auto font-[900] text-[#007a67] text-[16px]">
            ${{ venue.startingPrice }}/hr
          </span>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 min-h-[44px] py-2.5 rounded-[8px] font-bold text-xs flex items-center justify-center gap-2 transition-all"
            :class="isSaved ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600'"
            :aria-label="saveLabel"
            @click.stop="onToggleSave"
          >
            {{ isSaved ? '❤️ Saved' : '🤍 Save' }}
          </button>
          <a
            :href="venueHref"
            class="flex-[2] min-h-[44px] py-2.5 bg-[#007a67] text-white rounded-[8px] font-[900] text-xs shadow-md text-center no-underline inline-flex items-center justify-center"
            @click="navigateVenue($event, true)"
          >
            {{ t('viewDetails') }}
          </a>
        </div>
      </div>
    </div>
  </div>

  <div
    v-else
    class="group rounded-[16px] overflow-hidden border transition-all duration-300 shadow-sm hover:shadow-lg"
    :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'"
  >
    <div class="relative aspect-[400/176] h-44 overflow-hidden bg-gray-200 dark:bg-gray-700">
      <a
        :href="venueHref"
        class="block w-full h-full"
        @click="navigateVenue($event, true)"
      >
        <img
          :src="imageSrc"
          :alt="imageAlt"
          class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          width="400"
          height="176"
          :loading="priorityImage ? 'eager' : 'lazy'"
          :fetchpriority="priorityImage ? 'high' : undefined"
          @error="onImageError"
        />
      </a>
      <span v-if="venue.membership_enabled" class="absolute top-2 left-2 rounded-md px-2 py-1 text-[11px] font-bold text-white bg-[#007a67] shadow-md z-[1] pointer-events-none" :title="t('specialOffer')">
        {{ t('specialOffer') }}
      </span>
      <div class="absolute top-2 right-12 z-10">
        <button
          type="button"
          :aria-label="t('share')"
          class="p-3 mr-2 rounded-full shadow-lg transition-all active:scale-90 rounded-[999px]"
          :class="darkMode ? 'text-gray-300 hover:bg-gray-700 bg-gray-800/90' : 'bg-white/90 text-gray-600 hover:bg-gray-100'"
          @click.stop="handleShare"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </div>
      <div class="absolute top-2 right-2 z-10">
        <button
          type="button"
          class="p-2.5 min-h-[44px] min-w-[44px] rounded-full shadow-lg transition-all active:scale-90 rounded-[999px] inline-flex items-center justify-center"
          :class="isSaved ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-600'"
          :aria-label="saveLabel"
          @click.stop="onToggleSave"
        >
          <span aria-hidden="true">{{ isSaved ? '❤️' : '🤍' }}</span>
        </button>
      </div>
    </div>

    <a
      :href="venueHref"
      class="block p-4 no-underline cursor-pointer"
      @click="navigateVenue($event, true)"
    >
      <h3
        class="font-[900] text-[24px] leading-tight truncate mb-2"
        :class="darkMode ? 'text-white' : 'text-gray-900'"
      >
        {{ venue.name }}
      </h3>
      <div
        class="flex items-center gap-3 text-[14px] font-[400] mb-4"
        :class="darkMode ? 'text-gray-300' : 'text-gray-600'"
      >
        <span v-if="districtName" class="rounded-md px-2.5 py-0.5 text-xs font-medium shrink-0"
        :class="darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'">📍 {{ districtName }}</span>
        <span v-if="venue.mtrStation || venue.walkingDistance > 0" class="rounded-md px-2.5 py-0.5 text-xs font-medium shrink-0"
        :class="darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'"><template v-if="venue.mtrStation">🚇 {{ getStationDisplayName(venue.mtrStation, language) }} </template><template v-if="venue.mtrStation && venue.walkingDistance > 0"> • </template><template v-if="venue.walkingDistance > 0"> {{ venue.walkingDistance }} {{ t('min') }}</template></span>
        <span v-if="venue.court_count" class="rounded-md px-2.5 py-0.5 text-xs font-medium shrink-0"
        :class="darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'">🥅 {{ venue.court_count }} {{ venue.court_count === 1 ? t('court') : t('courts') }}</span>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-baseline gap-1">
          <div v-if="venue.startingPrice > 0" class="flex items-baseline gap-1">
            <span class="text-[12px] font-[700] uppercase"
            :class="[language === 'en' ? 'block' : 'hidden', darkMode ? 'text-gray-400' : 'text-gray-500']">
              {{ language === 'en' ? 'Starting price' : '' }}
            </span>
            <span class="text-[24px] font-[900] text-[#007a67]">
              ${{ venue.startingPrice }}
            </span>
            <span class="text-[12px] font-[700] uppercase"
            :class="[language === 'en' ? 'hidden' : 'block', darkMode ? 'text-gray-400' : 'text-gray-500']">
              {{ language === 'en' ? '' : '起' }}
            </span>
            <span class="text-[12px] font-[700] uppercase" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
              /{{ language === 'en' ? 'hr' : '小時' }}
            </span>
          </div>
        </div>
        <span
          class="px-4 py-2 bg-[#007a67] text-white rounded-[8px] font-bold text-sm shadow-md group-hover:brightness-110"
        >
          {{ t('viewDetails') }}
        </span>
      </div>
    </a>
  </div>
</template>
