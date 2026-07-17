<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import type { Language } from '../../../types';
import FaqSection, { type FaqItem } from './FaqSection.vue';
import { HK_DISTRICTS, getDistrictDisplayName } from '../../utils/hkDistricts';

const props = defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  mode: 'explore' | 'search' | 'search-district';
  sportName?: string;
  sportSlug?: string;
  districtSlug?: string;
  venueCount: number;
}>();

const open = ref(false);
const panelId = 'listing-seo-panel-body';

const districtName = computed(() =>
  props.districtSlug ? getDistrictDisplayName(props.districtSlug, props.language) : '',
);

const title = computed(() => {
  if (props.mode === 'search-district' && props.sportName && districtName.value) {
    return props.language === 'zh'
      ? `${districtName.value}${props.sportName}場地`
      : `${props.sportName} courts in ${districtName.value}`;
  }
  if (props.mode === 'search' && props.sportName) {
    return props.language === 'zh'
      ? `香港${props.sportName}場地`
      : `${props.sportName} courts in Hong Kong`;
  }
  return props.t('exploreSeoTitle');
});

const intro = computed(() => {
  const n = String(props.venueCount);
  if (props.mode === 'search-district' && props.sportName && districtName.value) {
    return props.t('searchDistrictSeoIntro')
      .replace(/\{\{sport\}\}/g, props.sportName)
      .replace(/\{\{district\}\}/g, districtName.value)
      .replace(/\{\{count\}\}/g, n);
  }
  if (props.mode === 'search' && props.sportName) {
    return props.t('searchSeoIntro')
      .replace(/\{\{sport\}\}/g, props.sportName)
      .replace(/\{\{count\}\}/g, n)
      .replace(/\{\{districts\}\}/g, String(HK_DISTRICTS.length));
  }
  return props.t('exploreSeoIntro')
    .replace(/\{\{count\}\}/g, n)
    .replace(/\{\{districts\}\}/g, String(HK_DISTRICTS.length));
});

const faqItems = computed((): FaqItem[] => {
  const sport = props.sportName || (props.language === 'zh' ? '運動' : 'sports');
  const district = districtName.value || (props.language === 'zh' ? '各區' : 'Hong Kong');
  return [
    {
      q: props.t('listingFaq1q').replace(/\{\{sport\}\}/g, sport).replace(/\{\{district\}\}/g, district),
      a: props.t('listingFaq1a').replace(/\{\{sport\}\}/g, sport).replace(/\{\{district\}\}/g, district).replace(/\{\{count\}\}/g, String(props.venueCount)),
    },
    {
      q: props.t('listingFaq2q'),
      a: props.t('listingFaq2a'),
    },
    {
      q: props.t('listingFaq3q'),
      a: props.t('listingFaq3a'),
    },
  ];
});

const buttonLabel = computed(() => (props.language === 'zh' ? '資料 ›' : 'Info ›'));

function openPanel() {
  open.value = true;
}

function closePanel() {
  open.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closePanel();
}

watch(open, (isOpen) => {
  if (typeof document === 'undefined') return;
  if (isOpen) {
    document.addEventListener('keydown', onKeydown);
    document.body.style.overflow = 'hidden';
  } else {
    document.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
  }
});

onUnmounted(() => {
  if (typeof document === 'undefined') return;
  document.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <!-- Map floating ? control — bottom-left -->
  <div class="absolute bottom-24 md:bottom-4 left-4 z-20 pointer-events-auto">
    <button
      type="button"
      class="w-11 h-11 rounded-full border shadow-lg text-lg font-black flex items-center justify-center transition-colors"
      :class="darkMode
        ? 'bg-gray-900/95 border-gray-700 text-gray-100 hover:bg-gray-800'
        : 'bg-white/95 border-gray-200 text-gray-700 hover:bg-white'"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="language === 'zh' ? '場地搜尋說明' : 'Venue listing info'"
      @click="openPanel"
    >
      ?
    </button>
  </div>

  <!-- FAQ JSON-LD always present while listing routes are shown -->
  <div class="sr-only" aria-hidden="true">
    <FaqSection
      :items="faqItems"
      :language="language"
      :t="t"
      :dark-mode="darkMode"
      inject-schema
    />
  </div>

  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="panelId + '-title'"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/50"
        aria-label="Close"
        @click="closePanel"
      />
      <div
        :id="panelId"
        class="relative w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border shadow-2xl overflow-hidden"
        :class="darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'"
      >
        <div
          class="flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0"
          :class="darkMode ? 'border-gray-800' : 'border-gray-100'"
        >
          <h2
            :id="panelId + '-title'"
            class="text-base md:text-lg font-black tracking-tight min-w-0 truncate"
            :class="darkMode ? 'text-white' : 'text-gray-900'"
          >
            {{ title }}
          </h2>
          <button
            type="button"
            class="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
            :class="darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-700'"
            aria-label="Close"
            @click="closePanel"
          >
            ×
          </button>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
          <div>
            <p
              class="text-sm leading-relaxed"
              :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
            >
              {{ intro }}
            </p>
            <p
              class="mt-3 text-sm leading-relaxed"
              :class="darkMode ? 'text-gray-500' : 'text-gray-500'"
            >
              {{ t('listingSeoHowTo') }}
            </p>
          </div>
          <FaqSection
            :items="faqItems"
            :language="language"
            :t="t"
            :dark-mode="darkMode"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
