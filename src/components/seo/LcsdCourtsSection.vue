<script setup lang="ts">
import type { Language } from '../../../types';

defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
}>();

const LCSD_URL_EN = 'https://www.lcsd.gov.hk/en/facilities/facilitieslist/courtlist.html';
const LCSD_URL_ZH = 'https://www.lcsd.gov.hk/tc/facilities/facilitieslist/courtlist.html';
</script>

<template>
  <section
    id="free-public-courts"
    class="w-full py-10 md:py-14"
    :class="darkMode ? 'bg-gray-900' : 'bg-white'"
    :aria-labelledby="language === 'zh' ? 'lcsd-heading-zh' : 'lcsd-heading-en'"
  >
    <div class="w-full max-w-7xl mx-auto px-4 md:px-6">
      <h2
        :id="language === 'zh' ? 'lcsd-heading-zh' : 'lcsd-heading-en'"
        class="text-2xl md:text-3xl font-black tracking-tight"
        :class="darkMode ? 'text-white' : 'text-gray-900'"
      >
        {{ t('lcsdHeading') }}
      </h2>
      <p
        class="mt-3 text-sm md:text-base leading-relaxed max-w-3xl"
        :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
      >
        {{ t('lcsdIntro') }}
      </p>
      <div class="mt-5 flex flex-wrap gap-3">
        <a
          :href="language === 'zh' ? LCSD_URL_ZH : LCSD_URL_EN"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-[#007a67] hover:brightness-110 no-underline min-h-[44px]"
        >
          {{ t('lcsdBrowse') }} →
        </a>
        <a
          href="/explore"
          class="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border no-underline min-h-[44px] transition-colors"
          :class="darkMode
            ? 'border-gray-600 text-gray-200 hover:border-[#79d8c7]'
            : 'border-gray-200 text-gray-700 hover:border-[#007a67] hover:text-[#007a67]'"
        >
          {{ t('lcsdBookable') }}
        </a>
      </div>
    </div>
  </section>
</template>
