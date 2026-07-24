<script setup lang="ts">
import { onMounted } from 'vue';
import type { Language } from '../../../types';
import VenueUpcomingEvents from './VenueUpcomingEvents.vue';
import { useGrindUpcomingEvents } from '../../composables/useGrindUpcomingEvents';

defineProps<{
  language: Language;
  darkMode: boolean;
  t: (key: string) => string;
}>();

const { loading, error, events, refresh } = useGrindUpcomingEvents();

onMounted(() => {
  document.title = 'Upcoming Events | Courts';
  void refresh();
});
</script>

<template>
  <div
    class="w-full min-h-screen min-w-0"
  >
    <div class="w-full py-6">
      <VenueUpcomingEvents
        class="w-full"
        standalone
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
