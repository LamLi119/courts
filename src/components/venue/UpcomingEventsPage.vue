<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { Language } from '../../../types';
import VenueUpcomingEvents from './VenueUpcomingEvents.vue';
import { useGrindUpcomingEvents } from '../../composables/useGrindUpcomingEvents';

defineProps<{
  language: Language;
  darkMode: boolean;
  t: (key: string) => string;
}>();

const router = useRouter();
const { loading, error, events, refresh } = useGrindUpcomingEvents();

onMounted(() => {
  document.title = 'Upcoming Events | Courts';
  void refresh();
});
</script>

<template>
  <div
    class="min-h-screen"
    :class="darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'"
  >
    <div class="mx-auto max-w-5xl px-4 py-6">
      <VenueUpcomingEvents
        :events="events"
        :loading="loading"
        :error="error"
        :dark-mode="darkMode"
        :language="language"
        :t="t"
        @retry="refresh"
      />
    </div>
  </div>
</template>
