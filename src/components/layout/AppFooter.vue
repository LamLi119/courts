<script setup lang="ts">
import type { Language } from '../../../types';

defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  variant?: 'overlay' | 'inline';
}>();

const CONTACT_EMAIL = 'info@theground.io';
const CONTACT_PHONE = '';
</script>

<template>
  <footer class="text-center text-[11px] leading-relaxed" :class="[
    variant === 'overlay'
      ? 'absolute bottom-3 left-3 right-3 z-20 pointer-events-auto rounded-[10px] px-3 py-2.5 shadow-md backdrop-blur'
      : 'px-4 py-6 border-t',
    variant === 'overlay'
      ? (darkMode ? 'bg-gray-900/90 border border-gray-700 text-gray-400' : 'bg-white/90 border border-gray-200 text-gray-500')
      : (darkMode ? 'border-gray-800 text-gray-500' : 'border-gray-200 text-gray-500'),
  ]">

    <div class="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <p class="font-bold text-[12px]" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
        {{ t('connectUs') }}
      </p>
      <a :href="`mailto:${CONTACT_EMAIL}`" class="font-semibold text-[#007a67] hover:underline">
        {{ CONTACT_EMAIL }}
      </a>
      <template v-if="CONTACT_PHONE">
        <span class="opacity-40" aria-hidden="true">·</span>
        <a class="font-semibold text-[#007a67] hover:underline">
          {{ CONTACT_PHONE }}
        </a>
      </template>
    </div>

    <p class="mt-2 opacity-80 max-w-md mx-auto">
      {{ t('referenceDisclaimer') }}
    </p>
  </footer>
</template>
