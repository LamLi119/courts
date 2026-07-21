<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { computed } from 'vue';
import type { AppTab } from '../../../types';

const router = useRouter();
const route = useRoute();

defineProps<{
  currentTab: AppTab;
  setTab: (t: AppTab) => void;
  t: (key: string) => string;
  darkMode: boolean;
  isAdmin?: boolean;
  onAdminClick: () => void;
}>();

const isHome = computed(() => route.name === 'home');

const goHome = () => {
  router.push('/');
};
</script>

<template>
  <nav
    class="fixed bottom-0 inset-x-0 z-[60] pb-safe border-t flex justify-around items-stretch px-2 pt-1 backdrop-blur-lg shadow-[0_-4px_10px_rgba(0,0,0,0.05)]"
    :class="darkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-100'"
    aria-label="Mobile"
  >
    <button
      type="button"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] py-2 transition-all"
      :class="isHome ? 'text-[#007a67]' : (darkMode ? 'text-gray-300' : 'text-gray-500')"
      @click="goHome"
    >
      <span class="text-xl leading-none" aria-hidden="true">🏠</span>
      <span class="text-[10px] font-bold uppercase tracking-wider">
        {{ t('home') }}
      </span>
    </button>

    <button
      type="button"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] py-2 transition-all"
      :class="!isHome && currentTab === 'explore' ? 'text-[#007a67]' : (darkMode ? 'text-gray-300' : 'text-gray-500')"
      @click="setTab('explore')"
    >
      <span class="text-xl leading-none" aria-hidden="true">📍</span>
      <span class="text-[10px] font-bold uppercase tracking-wider">
        {{ t('explore') }}
      </span>
    </button>

    <button
      type="button"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] py-2 transition-all"
      :class="currentTab === 'saved' ? 'text-red-500' : (darkMode ? 'text-gray-300' : 'text-gray-500')"
      @click="setTab('saved')"
    >
      <span class="text-xl leading-none" aria-hidden="true">❤️</span>
      <span class="text-[10px] font-bold uppercase tracking-wider">
        {{ t('saved') }}
      </span>
    </button>

    <button
      v-if="isAdmin"
      type="button"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] py-2 transition-all"
      :class="currentTab === 'admin' ? 'text-blue-500' : (darkMode ? 'text-gray-300' : 'text-gray-500')"
      @click="setTab('admin')"
    >
      <span class="text-xl leading-none" aria-hidden="true">🔑</span>
      <span class="text-[10px] font-bold uppercase tracking-wider">
        {{ t('admin') }}
      </span>
    </button>
  </nav>
</template>
