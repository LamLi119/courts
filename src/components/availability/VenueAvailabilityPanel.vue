<script setup lang="ts">
import { computed } from 'vue';
import type { Language, OperatingHours } from '../../../types';
import { buildAvailabilityTimetable } from './buildAvailabilityTimetable';
import { useVenueAvailability } from './useVenueAvailability';

const props = defineProps<{
  venueId: number;
  darkMode: boolean;
  language: Language;
  operatingHours?: OperatingHours | null;
}>();

const {
  selectedDate,
  loading,
  error,
  data,
  refresh,
  dateOptions,
} = useVenueAvailability(
  computed(() => props.venueId),
  computed(() => true),
);

const disclaimer = computed(() =>
  props.language === 'en'
    ? 'Times from the venue booking system and may change. Confirm on their site before booking.'
    : '時段由場地預訂系統提供，可能隨時變更。預訂前請於官方網站確認。',
);

function formatDateLabel(dateDash: string): string {
  const [y, m, d] = dateDash.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (props.language === 'zh') {
    return `${m}月${d}日`;
  }
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const timetable = computed(() => {
  const courts = data.value?.courts ?? [];
  return buildAvailabilityTimetable(courts, selectedDate.value, props.operatingHours);
});

const isDayClosed = computed(
  () => !loading.value && !error.value && data.value?.supported && timetable.value.dayClosed,
);

const isEmpty = computed(
  () =>
    !loading.value &&
    !error.value &&
    data.value?.supported &&
    !timetable.value.dayClosed &&
    timetable.value.timeLabels.length === 0,
);

function cellClass(status: string): string {
  if (status === 'available') return 'bg-green-500';
  return props.darkMode ? 'bg-gray-600' : 'bg-gray-300';
}

function statusLabel(status: string): string {
  if (props.language === 'zh') {
    return status === 'available' ? '可預約' : '不可預約';
  }
  return status === 'available' ? 'Available' : 'Unavailable';
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-2 overflow-x-auto pb-1" role="tablist">
      <button
        v-for="d in dateOptions"
        :key="d"
        type="button"
        role="tab"
        :aria-selected="selectedDate === d"
        class="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold border transition-colors"
        :class="
          selectedDate === d
            ? 'bg-[#007a67] border-[#007a67] text-white'
            : darkMode
              ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-100'
        "
        @click="selectedDate = d"
      >
        {{ formatDateLabel(d) }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center gap-2 text-[14px] opacity-70">
      <div class="w-5 h-5 border-2 border-[#007a67]/30 border-t-[#007a67] rounded-full animate-spin" />
      {{ language === 'en' ? 'Loading availability…' : '載入可預約時段…' }}
    </div>

    <div v-else-if="error" class="space-y-2">
      <p class="text-[14px] text-red-500 m-0">{{ error }}</p>
      <button type="button" class="text-[13px] font-bold text-[#007a67] hover:underline" @click="refresh">
        {{ language === 'en' ? 'Try again' : '重試' }}
      </button>
    </div>

    <p v-else-if="isDayClosed" class="text-[14px] opacity-70 m-0">
      {{ language === 'en' ? 'Venue is closed on this day.' : '此日休息。' }}
    </p>

    <p v-else-if="isEmpty" class="text-[14px] opacity-70 m-0">
      {{ language === 'en' ? 'No bookable slots for this date.' : '此日期暫無可預約時段。' }}
    </p>

    <template v-else>
      <div
        class="overflow-x-auto rounded-lg border"
        :class="darkMode ? 'border-gray-600' : 'border-gray-200'"
      >
        <table class="w-full border-collapse text-[11px]">
          <thead>
            <tr :class="darkMode ? 'bg-gray-700/50 text-gray-200' : 'bg-gray-50 text-gray-700'">
              <th
                class="sticky left-0 z-20 px-2 py-2 text-left font-bold min-w-[72px]"
                :class="darkMode ? 'bg-gray-700/50' : 'bg-gray-50'"
              >
                {{ language === 'en' ? 'Court' : '場地' }}
              </th>
              <th
                v-for="t in timetable.timeLabels"
                :key="t"
                class="px-1 py-2 text-center font-bold tabular-nums whitespace-nowrap min-w-[40px]"
              >
                {{ t }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in timetable.rows"
              :key="row.courtId"
              :class="darkMode ? 'border-t border-gray-600' : 'border-t border-gray-200'"
            >
              <th
                class="sticky left-0 z-10 px-2 py-1.5 text-left font-medium whitespace-nowrap max-w-[120px] truncate"
                :class="darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'"
                :title="row.courtName"
              >
                {{ row.courtName }}
              </th>
              <td
                v-for="(cell, i) in row.cells"
                :key="`${row.courtId}-${i}`"
                class="p-0.5"
              >
                <div
                  class="h-6 w-full min-w-[36px] rounded-sm"
                  :class="cellClass(cell.status)"
                  :title="`${row.courtName} ${timetable.timeLabels[i]}: ${statusLabel(cell.status)}`"
                  :aria-label="`${row.courtName} ${timetable.timeLabels[i]} ${statusLabel(cell.status)}`"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap gap-3 text-[11px] opacity-80">
        <span class="inline-flex items-center gap-1.5">
          <span class="inline-block w-3 h-3 rounded-sm bg-green-500" aria-hidden="true" />
          {{ language === 'en' ? 'Available' : '可預約' }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span
            class="inline-block w-3 h-3 rounded-sm"
            :class="darkMode ? 'bg-gray-600' : 'bg-gray-300'"
            aria-hidden="true"
          />
          {{ language === 'en' ? 'Unavailable' : '不可預約' }}
        </span>
      </div>
    </template>

    <p class="text-[11px] opacity-50 m-0">{{ disclaimer }}</p>
  </div>
</template>
