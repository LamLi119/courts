<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Venue, Language } from '../../types';
import { getStationDisplayName } from '../utils/mtrStations';
import { getVenueImageAlt } from '../utils/seo';
import { slugify } from '../utils/slugify';

const props = defineProps<{
  venue: Venue;
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  onViewDetails: () => void;
}>();

const imageAlt = computed(() => getVenueImageAlt(props.venue));

const shareFeedback = ref<string | null>(null);
const handleShare = async () => {
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/venues/${slugify(props.venue.name)}`
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
</script>

<template>
  <button type="button" class="w-full text-left" @click="onViewDetails">
    <div class="flex flex-col shadow-sm transition-all active:scale-[0.98]"
      :class="darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'">
      <div class="flex items-center gap-4 px-4 pt-3 pb-2">
        <div class="relative w-20 h-20 rounded-[16px] overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
          <img :src="venue.images[0] || '/placeholder.svg'" :alt="imageAlt" class="w-full h-full object-cover"
            loading="lazy" />
          <span v-if="venue.membership_enabled" class="absolute top-0 left-0 rounded-br-md px-1.5 py-0.5 text-[9px] font-bold text-white bg-[#007a67] shadow-sm" :title="t('specialOffer')">
            {{ t('specialOffer') }}
          </span>
        </div>

        <div class="flex-1 min-w-0">
          <h3 class="text-[18px] font-[900] leading-tight truncate mb-1"
            :class="darkMode ? 'text-white' : 'text-gray-900'">
            {{ venue.name }}
          </h3>
          <p v-if="venue.mtrStation" class="text-[13px] font-[400] truncate" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
            🚇 {{ getStationDisplayName(venue.mtrStation, language) }}
          </p>
          <div v-if="venue.walkingDistance" class="flex items-center gap-2 mt-1 text-[12px]">
            <span :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
              🚶 {{ venue.walkingDistance }} {{ t('min') }}
            </span>
          </div>
          <div v-if="venue.court_count != null && venue.court_count > 0" class="flex items-center gap-2 mt-1 text-[12px]">
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
        <div class="flex items-end justify-end pt-8">
          <div class="flex items-baseline gap-1">
            <span class="text-[11px] font-[700] opacity-60 uppercase"
            :class="language === 'en' ? 'block' : 'hidden'">
              {{ language === 'en' ? 'Up to' : '' }}
            </span>
            <span class="text-[18px] font-[900] text-[#007a67]">
              ${{ venue.startingPrice }}
            </span>
            <span class="text-[11px] font-[700] opacity-60 uppercase"
            :class="language === 'en' ? 'hidden' : 'block'">
              {{ language === 'en' ? '' : '起' }}
            </span>
            <span class="text-[11px] font-[700] opacity-60 uppercase">
              /{{ language === 'en' ? 'hr' : '小時' }}
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  </button>
</template>