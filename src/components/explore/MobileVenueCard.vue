<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Venue, Language } from '../../../types';
import { getStationDisplayName } from '../../utils/mtrStations';
import { getVenueDistrictSlug, getDistrictDisplayName } from '../../utils/hkDistricts';
import { getVenueImageAlt } from '../../utils/seo';
import { slugify } from '../../utils/slugify';
import { isGcsImageUrl, venueCardImageSrc } from '../../utils/venueImageUrl';

const props = defineProps<{
  venue: Venue;
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  onViewDetails: () => void;
  /** First above-the-fold card: eager-load image for LCP. */
  priorityImage?: boolean;
}>();

const imageAlt = computed(() => getVenueImageAlt(props.venue));
const venueHref = computed(() => `/venues/${slugify(props.venue.name)}`);
const imgFailed = ref(false);
const useProxy = ref(false);
const imageSrc = computed(() => {
  if (imgFailed.value) return '/placeholder.svg';
  const raw = props.venue.images?.[0] || '/placeholder.svg';
  return venueCardImageSrc(raw === '/placeholder.svg' ? raw : raw, useProxy.value);
});

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

function navigateVenue(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  props.onViewDetails();
}
</script>

<template>
  <a :href="venueHref" class="w-full text-left block no-underline" @click="navigateVenue">
    <div class="flex flex-col shadow-sm transition-all active:scale-[0.98]"
      :class="darkMode ? 'border-gray-800' : 'border-gray-200'">
      <div class="flex items-center gap-4 px-4 pt-3 pb-2">
        <div class="relative w-20 h-20 aspect-square rounded-[16px] overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
          <img
            :src="imageSrc"
            :alt="imageAlt"
            class="w-full h-full object-cover"
            width="80"
            height="80"
            :loading="priorityImage ? 'eager' : 'lazy'"
            :fetchpriority="priorityImage ? 'high' : undefined"
            @error="onImageError"
          />
          <span v-if="venue.membership_enabled" class="absolute top-0 left-0 rounded-br-md px-1.5 py-0.5 text-[9px] font-bold text-white bg-[#007a67] shadow-sm" :title="t('specialOffer')">
            {{ t('specialOffer') }}
          </span>
        </div>

        <div class="flex-1 min-w-0">
          <h3 class="text-[18px] font-[900] leading-tight truncate mb-1"
            :class="darkMode ? 'text-white' : 'text-gray-900'">
            {{ venue.name }}
          </h3>
          <div v-if="districtName" class="text-[13px] font-[400] truncate">
            <span :class="darkMode ? 'text-gray-300' : 'text-gray-700'">📍 {{ districtName }}</span>
          </div>
          <p v-if="venue.mtrStation || venue.walkingDistance" class="text-[13px] font-[400] truncate" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            <template v-if="venue.mtrStation">🚇 {{ getStationDisplayName(venue.mtrStation, language) }} </template><template v-if="venue.mtrStation && venue.walkingDistance"> • </template><template v-if="venue.walkingDistance"> {{ venue.walkingDistance }} {{ t('min') }}</template>
          </p>
          <div v-if="venue.court_count != null && venue.court_count > 0" class="flex items-center gap-2 text-[12px]">
            <span :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
              🥅 {{ venue.court_count }} {{ venue.court_count === 1 ? t('venue') : t('venues') }}
            </span>
          </div>
        </div>

      <div class="self-start flex flex-col items-end justify-end">
        <div class="flex items-center gap-2">
        <button type="button" id="share-button" aria-label="Share"
        class="p-2.5 rounded-full mt-auto shadow-sm transition-all active:scale-90"
          :class="darkMode ? 'text-gray-300 hover:bg-gray-700' : 'bg-white/90 text-gray-600 hover:bg-gray-100'"
          @click.stop="handleShare">
          <svg :id="`${venue.name}-share-icon`" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
        <button type="button" class="p-2 rounded-full mt-auto shadow-sm transition-all active:scale-90"
          :class="isSaved ? 'bg-red-500 text-white' : (darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-500')"
          @click.stop="onToggleSave">
          {{ isSaved ? '❤️' : '🤍' }}
        </button></div>
        <div v-if="venue.startingPrice > 0" class="flex items-end justify-end pt-8">
          <div class="flex flex-col items-end gap-0.5">
            <span class="text-[11px] font-[700] opacity-60 uppercase leading-none">
              {{ language === 'en' ? 'Starting price' : t('startingFrom') }}
            </span>
            <div class="flex items-baseline gap-0.5 leading-none">
              <span class="text-[18px] font-[900] text-[#007a67]">
                ${{ venue.startingPrice }}
              </span>
              <span v-if="language !== 'en'" class="text-[11px] font-[700] opacity-60 uppercase">起</span>
              <span class="text-[11px] font-[700] opacity-60 uppercase">
                /{{ language === 'en' ? 'hr' : '小時' }}
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  </a>
</template>
