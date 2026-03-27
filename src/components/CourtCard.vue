<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Venue, Language } from '../../types';
import { getStationDisplayName } from '../utils/mtrStations';
import { getVenueImageAlt } from '../utils/seo';
import { slugify } from '../utils/slugify';

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
}>();

const isExpanded = ref(false);
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

const toggleExpand = (e: MouseEvent) => {
  e.stopPropagation();
  isExpanded.value = !isExpanded.value;
};
</script>

<template>
  <div v-if="isMobile">
    <div
      class="border rounded-[16px] overflow-hidden mb-4 transition-all duration-300 shadow-sm"
      :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'"
    >
      <div
        class="flex items-center p-4 cursor-pointer gap-4"
        @click="onClick"
      >
        <div class="relative w-16 h-16 rounded-[16px] overflow-hidden flex-shrink-0">
          <img
            :src="venue.images[0] || '/placeholder.svg'"
            class="w-full h-full object-cover"
            :alt="venue.name"
            loading="lazy"
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
            class="text-[14px] font-[400] opacity-70"
            :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
          >
            🚇 {{ getStationDisplayName(venue.mtrStation, language) }}
          </p>
        </div>
        <button
          class="p-2 rounded-full transition-transform"
          :class="[isExpanded ? 'rotate-180' : '', darkMode ? 'bg-gray-700' : 'bg-gray-50']"
          @click.stop="toggleExpand"
        >
          ▼
        </button>
      </div>

      <div
        v-if="isExpanded"
        class="px-4 pb-4 animate-in slide-in-from-top duration-200"
      >
        <div
          class="flex items-center gap-3 text-[12px] font-[400] mb-3"
          :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
        >
          <span>🚶 {{ venue.walkingDistance }} {{ t('min') }}</span>
          <span>⬆️ {{ venue.ceilingHeight }}m</span>
          <span class="ml-auto font-[900] text-[#007a67] text-[16px]">
            ${{ venue.startingPrice }}/hr
          </span>
        </div>
        <div class="flex gap-2">
          <button
            class="flex-1 py-2.5 rounded-[8px] font-bold text-xs flex items-center justify-center gap-2 transition-all"
            :class="isSaved ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'"
            @click.stop="onToggleSave"
          >
            {{ isSaved ? '❤️ Saved' : '🤍 Save' }}
          </button>
          <button
            class="flex-[2] py-2.5 bg-[#007a67] text-white rounded-[8px] font-[900] text-xs shadow-md"
            @click="onViewDetail ?? onClick"
          >
            {{ t('viewDetails') }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div
    v-else
    class="group cursor-pointer rounded-[16px] overflow-hidden border transition-all duration-300 hover:shadow-2xl"
    :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'"
    @click="onClick"
    role="button"
  >
      <div class="relative h-44 overflow-hidden">
      <img
        :src="venue.images[0] || '/placeholder.svg'"
        :alt="imageAlt"
        class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        loading="lazy"
      />
      <span v-if="venue.membership_enabled" class="absolute top-2 left-2 rounded-md px-2 py-1 text-[11px] font-bold text-white bg-[#007a67] shadow-md z-10" :title="t('specialOffer')">
        {{ t('specialOffer') }}
      </span>
      <div class="absolute top-2 right-12">
      <button type="button" id="share-button" aria-label="Share"
        class="p-3 mr-2 rounded-full shadow-lg transition-all active:scale-90 rounded-[999px]"
          :class="darkMode ? 'text-gray-300 hover:bg-gray-700' : 'bg-white/90 text-gray-600 hover:bg-gray-100'"
          @click.stop="handleShare">
          <svg id="share-icon" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </div>
      <div class="absolute top-2 right-2">
        <button
          class="p-2.5 rounded-full shadow-lg transition-all active:scale-90 rounded-[999px]"
          :class="isSaved ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-500'"
          @click.stop="onToggleSave"
        >
          {{ isSaved ? '❤️' : '🤍' }}
        </button>
      </div>
    </div>

    <div class="p-4">
      <h3
        class="font-[900] text-[24px] leading-tight truncate mb-2"
        :class="darkMode ? 'text-white' : 'text-gray-900'"
      >
        {{ venue.name }}
      </h3>
      <div
        class="flex items-center gap-3 text-[14px] font-[400] mb-4"
        :class="darkMode ? 'text-gray-400' : 'text-gray-500'"
      >
        <span v-if="venue.mtrStation" class="rounded-md px-2.5 py-0.5 text-xs font-medium shrink-0"
        :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'">🚇 {{ getStationDisplayName(venue.mtrStation, language) }}</span>
        <span v-if="venue.walkingDistance > 0" class="rounded-md px-2.5 py-0.5 text-xs font-medium shrink-0"
        :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'">🚶 {{ venue.walkingDistance }} {{ t('min') }}</span>
        <span v-if="venue.court_count" class="rounded-md px-2.5 py-0.5 text-xs font-medium shrink-0"
        :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'">🥅 {{ venue.court_count }} {{ venue.court_count === 1 ? t('court') : t('courts') }}</span>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-baseline gap-1">
          <div v-if="venue.startingPrice > 0" class="flex items-baseline gap-1">
            <span class="text-[12px] font-[700] opacity-60 uppercase"
            :class="language === 'en' ? 'block' : 'hidden'">
              {{ language === 'en' ? 'Up to' : '' }}
            </span>
            <span class="text-[24px] font-[900] text-[#007a67]">
              ${{ venue.startingPrice }}
            </span>
            <span class="text-[12px] font-[700] opacity-60 uppercase"
            :class="language === 'en' ? 'hidden' : 'block'">
              {{ language === 'en' ? '' : '起' }}
            </span>
            <span class="text-[12px] font-[700] opacity-60 uppercase">
              /{{ language === 'en' ? 'hr' : '小時' }}
            </span>
          </div>
        </div>
        <button
          class="px-4 py-2 bg-[#007a67] text-white rounded-[8px] font-bold text-sm shadow-md group-hover:brightness-110 rounded-[8px]"
          @click.stop="onViewDetail ? onViewDetail() : onClick()"
        >
          {{ t('viewDetails') }}
        </button>
      </div>
    </div>
  </div>
</template>

