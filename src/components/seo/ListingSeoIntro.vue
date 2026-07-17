<script setup lang="ts">
import { computed } from 'vue';
import type { Language } from '../../../types';
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
</script>

<template>
  <aside
    class="listing-seo-intro shrink-0 px-4 py-3 border-b"
    :class="darkMode ? 'border-gray-800 bg-gray-900/95' : 'border-gray-200 bg-white/95'"
    :aria-label="title"
  >
    <h2
      class="text-sm md:text-base font-black tracking-tight"
      :class="darkMode ? 'text-white' : 'text-gray-900'"
    >
      {{ title }}
    </h2>
    <p
      class="mt-1.5 text-xs md:text-sm leading-relaxed line-clamp-3 md:line-clamp-none"
      :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
    >
      {{ intro }}
    </p>
    <p
      class="mt-1 text-[11px] md:text-xs leading-relaxed opacity-80"
      :class="darkMode ? 'text-gray-500' : 'text-gray-500'"
    >
      {{ t('listingSeoHowTo') }}
    </p>
  </aside>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
