<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import type { Venue, Language } from '../../../types';
import { buildVenueSeoSections } from '../../utils/venueContent';

const props = defineProps<{
  venue: Venue;
  language: Language;
  darkMode: boolean;
  t: (key: string) => string;
  canSeeSpecialOffer?: boolean;
  sanitizeDescription?: (html: string | undefined) => string;
}>();

const open = ref(false);
const panelId = 'venue-seo-panel';

const sections = computed(() => buildVenueSeoSections(props.venue, props.language));

const hasSpecialOffer = computed(
  () => props.venue.membership_enabled
    && !!(props.venue.membership_description || props.venue.membership_join_link),
);

const specialOfferTeaser = computed(() =>
  props.language === 'zh' ? '此場館設有特別優惠。' : 'This venue has a special offer.',
);

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
  <div class="venue-seo-sections sr-only" aria-hidden="true" />

  <Teleport to="body">
    <button
      type="button"
      class="fixed bottom-24 left-4 lg:bottom-6 z-[45] w-11 h-11 rounded-full border shadow-lg text-lg font-black flex items-center justify-center transition-colors"
      :class="darkMode
        ? 'bg-gray-900/95 border-gray-700 text-gray-100 hover:bg-gray-800'
        : 'bg-white/95 border-gray-200 text-gray-700 hover:bg-white'"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="language === 'zh' ? '場地詳情說明' : 'Venue details info'"
      @click="openPanel"
    >
      ?
    </button>

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
            {{ t('venueOverview') }}
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
        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
          <div
            v-if="hasSpecialOffer"
            class="rounded-xl border p-4"
            :class="darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'"
          >
            <h3
              class="text-sm font-black uppercase tracking-wide mb-2"
              :class="darkMode ? 'text-white' : 'text-gray-900'"
            >
              {{ language === 'en' ? 'Special offer' : '特別優惠' }}
            </h3>
            <p
              v-if="!canSeeSpecialOffer || !venue.membership_description"
              class="text-sm leading-relaxed"
              :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
            >
              {{ specialOfferTeaser }}
              <span v-if="!canSeeSpecialOffer">
                {{ language === 'zh' ? '登入以查看詳情。' : ' Log in to view details.' }}
              </span>
            </p>
            <div
              v-else-if="sanitizeDescription"
              class="text-sm leading-relaxed description-html"
              :class="darkMode ? 'text-gray-300' : 'text-gray-700'"
              v-html="sanitizeDescription(venue.membership_description)"
            />
          </div>

          <div
            v-for="(sec, idx) in sections"
            :key="idx"
            class="rounded-xl border p-4"
            :class="darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'"
          >
            <h3
              class="text-sm md:text-base font-black tracking-tight mb-2"
              :class="darkMode ? 'text-white' : 'text-gray-900'"
            >
              {{ sec.heading }}
            </h3>
            <p
              v-for="(para, pIdx) in sec.paragraphs"
              :key="pIdx"
              class="text-sm leading-relaxed"
              :class="[
                darkMode ? 'text-gray-300' : 'text-gray-700',
                pIdx > 0 ? 'mt-2' : '',
              ]"
            >
              {{ para }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
