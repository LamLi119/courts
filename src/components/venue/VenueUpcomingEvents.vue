<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import type { Language } from '../../../types';
import type { GrindEventRow } from '../../utils/grindEventFormat';
import {
  formatGrindEventCardLine,
  grindExploreEventsUrl,
  grindPublicEventUrl,
  eventImageSrc,
} from '../../utils/grindEventFormat';

const props = defineProps<{
  events: GrindEventRow[];
  loading: boolean;
  error: string | null;
  darkMode: boolean;
  language: Language;
  t: (key: string) => string;
  /** Full-width layout for /upcoming-events page */
  standalone?: boolean;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const scrollContainer = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

function updateScrollState() {
  const el = scrollContainer.value;
  if (!el) return;
  canScrollLeft.value = el.scrollLeft > 0;
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

function scroll(direction: 'left' | 'right') {
  const el = scrollContainer.value;
  if (!el) return;
  const amount = Math.min(el.clientWidth * 0.85, 320);
  el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
}

onMounted(() => {
  updateScrollState();
});

watch(
  () => [props.loading, props.events.length] as const,
  () => {
    nextTick(() => updateScrollState());
  },
);

const seeAllHref = computed(() => grindExploreEventsUrl());

const EMPTY_DELAY_MS = 10_000;
const showEmpty = ref(false);
let emptyTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => [props.loading, props.events.length, props.error] as const,
  ([loading, len, err]) => {
    if (emptyTimer) {
      clearTimeout(emptyTimer);
      emptyTimer = null;
    }
    if (loading || err || len > 0) {
      showEmpty.value = false;
      return;
    }
    emptyTimer = setTimeout(() => {
      showEmpty.value = true;
    }, EMPTY_DELAY_MS);
  },
  { immediate: true },
);

onUnmounted(() => {
  if (emptyTimer) clearTimeout(emptyTimer);
});

const showSkeleton = computed(
  () =>
    (props.loading && props.events.length === 0) ||
    (!props.loading && !props.error && props.events.length === 0 && !showEmpty.value),
);

function goingLabel(n: number): string {
  const tpl = props.t('attendeesGoing');
  return tpl.includes('{{n}}') ? tpl.replace(/\{\{n\}\}/g, String(n)) : `${n} ${tpl}`;
}
</script>

<template>
  <section class="venue-upcoming-events w-full" aria-labelledby="venue-upcoming-events-heading">
    <div
      class="mb-2 flex flex-row items-center justify-between gap-3"
      :class="standalone ? 'px-4 md:px-6' : ''"
    >
      <h2
        id="venue-upcoming-events-heading"
        class="text-[18px] md:text-[20px] font-black tracking-tight m-0"
        :class="darkMode ? 'text-white' : 'text-gray-900'"
      >
        {{ t('upcomingEvents') }}
      </h2>
      <a
        id="see-all-upcoming-events"
        :href="seeAllHref"
        target="_blank"
        rel="noopener noreferrer"
        class="shrink-0 text-[13px] md:text-[14px] font-bold text-[#007a67] hover:underline"
      >
        {{ t('seeAllEvents') }}
      </a>
    </div>

    <div
      v-if="showSkeleton"
      class="flex gap-3 overflow-x-auto pb-2 scrollbar-none"
      :class="standalone ? 'px-4 md:px-6' : ''"
    >
      <div v-for="i in 4" :key="i" class="w-[260px] shrink-0">
        <div
          class="rounded-[14px] border overflow-hidden animate-pulse"
          :class="darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-100'"
        >
          <div class="aspect-[4/5] w-full" :class="darkMode ? 'bg-gray-700' : 'bg-gray-200'" />
          <div class="p-3 space-y-2">
            <div class="h-3 w-3/4 rounded" :class="darkMode ? 'bg-gray-600' : 'bg-gray-200'" />
            <div class="h-4 w-full rounded" :class="darkMode ? 'bg-gray-600' : 'bg-gray-200'" />
            <div class="h-3 w-1/2 rounded" :class="darkMode ? 'bg-gray-600' : 'bg-gray-200'" />
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="error && events.length === 0"
      class="py-6 text-center rounded-[14px] border"
      :class="[
        standalone ? 'mx-4 md:mx-6' : '',
        darkMode ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-gray-50',
      ]"
    >
      <p class="text-[14px] mb-3" :class="darkMode ? 'text-gray-400' : 'text-gray-600'">
        {{ t('eventsCouldNotLoad') }}
      </p>
      <button
        type="button"
        class="btn btn-ghost btn-sm font-bold text-[#007a67]"
        @click="emit('retry')"
      >
        {{ t('tryAgain') }}
      </button>
    </div>

    <div
      v-else-if="showEmpty"
      class="py-6 text-center text-[14px]"
      :class="[standalone ? 'px-4 md:px-6' : '', darkMode ? 'text-gray-500' : 'text-gray-500']"
    >
      {{ t('noUpcomingEvents') }}
    </div>

    <div v-else-if="events.length > 0" class="group relative w-full" :class="standalone ? '' : '-mx-0.5'">
      <button
        v-show="canScrollLeft"
        type="button"
        class="absolute top-[42%] z-10 hidden md:flex size-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-opacity hover:opacity-90"
        :class="[
          standalone ? 'left-4 md:left-6' : 'left-0',
          darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900',
        ]"
        aria-label="Scroll left"
        @click="scroll('left')"
      >
        <span class="text-lg leading-none" aria-hidden="true">‹</span>
      </button>
      <button
        v-show="canScrollRight"
        type="button"
        class="absolute top-[42%] z-10 hidden md:flex size-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-opacity hover:opacity-90"
        :class="[
          standalone ? 'right-4 md:right-6' : 'right-0',
          darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900',
        ]"
        aria-label="Scroll right"
        @click="scroll('right')"
      >
        <span class="text-lg leading-none" aria-hidden="true">›</span>
      </button>

      <div
        ref="scrollContainer"
        class="scrollbar-none flex gap-3 overflow-x-auto p-0.5 pb-2"
        :class="standalone ? 'px-4 md:px-6' : ''"
        @scroll="updateScrollState"
      >
        <a
          id="{{ ev.name }}-click"
          v-for="ev in events"
          :key="ev.id"
          :href="grindPublicEventUrl(ev.id)"
          target="_blank"
          rel="noopener noreferrer"
          class="w-[260px] shrink-0 rounded-[14px] border overflow-hidden shadow-level1 flex flex-col gap-2 text-left transition-shadow hover:shadow-md"
          :class="darkMode ? 'border-gray-600 bg-gray-800/80 shadow-gray-600/80' : 'border-gray-200 bg-white shadow-gray-200'"
        >
          <div class="relative w-full overflow-hidden p-3">
            <img
              :src="eventImageSrc(ev.profile?.filePath)"
              :alt="ev.name"
              class="block aspect-[4/5] w-full object-cover rounded-[10px]"
              loading="lazy"
            />
          </div>
          <div class="px-3 pb-3 flex flex-col gap-1.5 min-h-0 flex-1">
            <p
              class="flex items-start gap-1 text-[12px] font-semibold leading-snug m-0"
              :class="darkMode ? 'text-sky-300/90' : 'text-sky-700'"
            >
              <span class="shrink-0 mt-0.5 opacity-80" aria-hidden="true">🕐</span>
              <span>{{ formatGrindEventCardLine(ev.startDate, ev.endDate, language) }}</span>
            </p>
            <h3
              class="text-[15px] font-black leading-snug line-clamp-2 m-0"
              :class="darkMode ? 'text-white' : 'text-gray-900'"
            >
              {{ ev.name }}
            </h3>
            <p
              v-if="ev.companyName || ev.company?.name"
              class="text-[13px] font-bold line-clamp-2 m-0"
              :class="darkMode ? 'text-gray-300' : 'text-gray-800'"
            >
              {{ ev.companyName || ev.company?.name }}
            </p>
            <div class="mt-auto flex flex-col gap-1 pt-1">
              <p
                v-if="ev.location"
                class="flex items-center gap-1 text-[12px] m-0 truncate"
                :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
              >
                <span class="shrink-0" aria-hidden="true">📍</span>
                <span class="truncate">{{ ev.location }}</span>
              </p>
              <p
                v-if="ev.isDisplayHeadCount !== false && (ev.joinCount ?? 0) > 0"
                class="flex items-center gap-1 text-[12px] m-0"
                :class="darkMode ? 'text-gray-400' : 'text-gray-600'"
              >
                <span class="shrink-0" aria-hidden="true">👥</span>
                <span>{{ goingLabel(ev.joinCount) }}</span>
              </p>
            </div>
          </div>
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.scrollbar-none {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
