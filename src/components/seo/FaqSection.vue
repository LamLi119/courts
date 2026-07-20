<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import type { Language } from '../../../types';

export type FaqItem = { q: string; a: string };

const props = defineProps<{
  items: FaqItem[];
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  heading?: string;
  /** When set, inject FAQPage JSON-LD into document head */
  injectSchema?: boolean;
}>();

const resolvedHeading = computed(
  () => props.heading || props.t('faqHeading'),
);

function removeFaqJsonLd() {
  document.querySelectorAll('script[data-seo-faq]').forEach((el) => el.remove());
}

function injectFaqJsonLd() {
  if (!props.injectSchema || typeof document === 'undefined') return;
  removeFaqJsonLd();
  if (!props.items.length) return;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: props.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.setAttribute('data-seo-faq', '1');
  el.textContent = JSON.stringify(ld);
  document.head.appendChild(el);
}

onMounted(injectFaqJsonLd);
watch(() => props.items, injectFaqJsonLd, { deep: true });
onUnmounted(removeFaqJsonLd);
</script>

<template>
  <section
    class="w-full"
    :aria-label="resolvedHeading"
  >
    <h2
      class="text-xl md:text-2xl font-black tracking-tight mb-4 md:mb-6"
      :class="darkMode ? 'text-white' : 'text-gray-900'"
    >
      {{ resolvedHeading }}
    </h2>
    <div class="space-y-3 md:space-y-4">
      <details
        v-for="(item, idx) in items"
        :key="idx"
        class="group rounded-xl border px-4 py-3"
        :class="darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'"
      >
        <summary
          class="cursor-pointer list-none font-bold text-sm md:text-base flex items-center justify-between gap-3"
          :class="darkMode ? 'text-gray-100' : 'text-gray-900'"
        >
          <span>{{ item.q }}</span>
          <span
            class="shrink-0 text-lg leading-none opacity-50 group-open:rotate-45 transition-transform"
            aria-hidden="true"
          >+</span>
        </summary>
        <p
          class="mt-3 text-sm leading-relaxed"
          :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
        >
          {{ item.a }}
        </p>
      </details>
    </div>
  </section>
</template>

<style scoped>
summary::-webkit-details-marker {
  display: none;
}
</style>
