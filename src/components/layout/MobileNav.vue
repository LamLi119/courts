<script setup lang="ts">
import type { AppTab } from '../../../types';

const props = defineProps<{
  currentTab: AppTab;
  setTab: (t: AppTab) => void;
  t: (key: string) => string;
  darkMode: boolean;
  isAdmin?: boolean;
  onAdminClick: () => void;
}>();
</script>

<template>
  <div
    class="fixed bottom-0 inset-x-0 z-[60] pb-safe border-t flex justify-around items-center px-4 py-3 backdrop-blur-lg shadow-[0_-4px_10px_rgba(0,0,0,0.05)]"
    :class="darkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-100'"
  >
    <button
      class="flex-1 flex flex-col items-center gap-1 transition-all"
      :class="currentTab === 'explore' ? 'text-[#007a67] scale-110' : 'text-gray-400'"
      @click="setTab('explore')"
    >
      <span class="text-xl">📍</span>
      <span class="text-[10px] font-bold uppercase tracking-wider">
        {{ t('explore') }}
      </span>
    </button>

    <button
      class="flex-1 flex flex-col items-center gap-1 transition-all"
      :class="currentTab === 'saved' ? 'text-red-500 scale-110' : 'text-gray-400'"
      @click="setTab('saved')"
    >
      <span class="text-xl">❤️</span>
      <span class="text-[10px] font-bold uppercase tracking-wider">
        {{ t('saved') }}
      </span>
    </button>

    <button
      v-if="isAdmin"
      class="flex-1 flex flex-col items-center gap-1 transition-all"
      :class="currentTab === 'admin' ? 'text-blue-500 scale-110' : 'text-gray-400'"
      @click="setTab('admin')"
    >
      <span class="text-xl">🔑</span>
      <span class="text-[10px] font-bold uppercase tracking-wider">
        {{ t('admin') }}
      </span>
    </button>
  </div>
</template>

