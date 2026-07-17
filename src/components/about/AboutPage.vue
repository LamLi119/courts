<script setup lang="ts">
import type { Language } from '../../../types';
import AboutContent from '../seo/AboutContent.vue';
import AppFooter from '../layout/AppFooter.vue';

defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  setLanguage: (l: Language) => void;
}>();
</script>

<template>
  <div class="w-full min-h-[70vh]" :class="darkMode ? 'bg-gray-900' : 'bg-white'">
    <div class="w-full max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-14">
      <AboutContent
        :language="language"
        :t="t"
        :dark-mode="darkMode"
      />
    </div>
    <AppFooter
      :language="language"
      :t="t"
      :dark-mode="darkMode"
      :set-language="setLanguage"
      variant="landing"
    />
  </div>
</template>
