<script setup lang="ts">
import type { Language } from '../../../types';

defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
}>();

const CONTACT_EMAIL = 'info@theground.io';
</script>

<template>
  <article class="space-y-6 max-w-3xl">
    <div>
      <h2
        class="text-2xl md:text-3xl font-black tracking-tight"
        :class="darkMode ? 'text-white' : 'text-gray-900'"
      >
        {{ t('aboutHeading') }}
      </h2>
      <p
        class="mt-3 text-sm md:text-base leading-relaxed"
        :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
      >
        {{ t('aboutIntro') }}
      </p>
    </div>

    <div>
      <h3
        class="text-lg font-black tracking-tight"
        :class="darkMode ? 'text-white' : 'text-gray-900'"
      >
        {{ t('aboutMethodHeading') }}
      </h3>
      <p
        class="mt-2 text-sm md:text-base leading-relaxed"
        :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
      >
        {{ t('aboutMethodBody') }}
      </p>
    </div>

    <div>
      <h3
        class="text-lg font-black tracking-tight"
        :class="darkMode ? 'text-white' : 'text-gray-900'"
      >
        {{ t('aboutBrandHeading') }}
      </h3>
      <p
        class="mt-2 text-sm md:text-base leading-relaxed"
        :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
      >
        {{ t('aboutBrandBody') }}
      </p>
    </div>

    <div>
      <h3
        class="text-lg font-black tracking-tight"
        :class="darkMode ? 'text-white' : 'text-gray-900'"
      >
        {{ t('contactSupport') }}
      </h3>
      <p
        class="mt-2 text-sm md:text-base leading-relaxed"
        :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
      >
        {{ t('aboutContactBody') }}
        <a
          :href="`mailto:${CONTACT_EMAIL}`"
          class="font-semibold text-[#007a67] hover:underline"
        >{{ CONTACT_EMAIL }}</a>
      </p>
    </div>
  </article>
</template>
