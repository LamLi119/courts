<script setup lang="ts">
import { computed } from 'vue';
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
</script>

<template>
  <section
    class="w-full border-t"
    :class="darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'"
  >
    <div class="w-full max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8">
      <div>
        <h2
          class="text-xl md:text-2xl font-black tracking-tight"
          :class="darkMode ? 'text-white' : 'text-gray-900'"
        >
          {{ title }}
        </h2>
        <p
          class="mt-3 text-sm md:text-base leading-relaxed max-w-3xl"
          :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
        >
          {{ intro }}
        </p>
        <p
          class="mt-3 text-sm leading-relaxed max-w-3xl"
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
        inject-schema
      />
    </div>
  </section>
</template>
