<script setup lang="ts">
import { useRouter } from 'vue-router';
import type { Language, AppTab } from '../../types';
import logoUrl from '../assets/green-G.svg';

const router = useRouter();

const props = defineProps<{
  language: Language;
  setLanguage: (l: Language) => void;
  isAdmin: boolean;
  onAdminClick: () => void;
  onLoginClick?: () => void;
  onLogout?: () => void;
  darkMode: boolean;
  setDarkMode: (d: boolean) => void;
  t: (key: string) => string;
  currentTab: AppTab;
  setTab: (t: AppTab) => void;
  viewMode?: 'map' | 'list';
  setViewMode?: (mode: 'map' | 'list') => void;
  /** When true (e.g. on venue detail page), hide Explore and Saved nav tabs */
  hideNavTabs?: boolean;
  filterSpecialOffer?: boolean;
  setFilterSpecialOffer?: (v: boolean) => void;
}>();

const openFindEvents = () => {
  window.open('https://www.theground.io', '_blank');
};
</script>

<template>
  <header :class="[
    'sticky top-0 z-[60] backdrop-blur-md border-b shadow-sm',
    darkMode ? 'bg-gray-900/95 border-gray-800' : 'bg-white/95 border-gray-200'
  ]">
    <div class="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-4 md:gap-8">
        <div class="flex items-center gap-2.5 cursor-pointer group" @click="setTab('explore')">
          <div
            class="w-10 h-10 transition-transform duration-300 group-hover:rotate-12 group-active:scale-90 flex items-center justify-center">
            <img :src="logoUrl" alt="TheGround.io" class="w-10 h-10" />
          </div>
          <h1 class="hidden sm:block text-[20px] font-[900] tracking-tighter text-[#007a67]">
            Courts
          </h1>
        </div>

        <nav v-if="!hideNavTabs" class="hidden sm:flex items-center gap-3 md:gap-6">
          <button type="button" class="btn btn-nav hidden sm:block"
            :class="currentTab === 'explore' ? 'btn-nav-active' : ''" @click="setTab('explore')">
            {{ t('explore') }}
          </button>
          <button type="button" class="btn btn-nav hidden sm:block"
            :class="currentTab === 'saved' ? 'text-red-500' : ''" @click="setTab('saved')">
            {{ t('saved') }}
          </button>
          <!-- TODO: Add sport type filter -->
          <a href="/search/pickleball"
            class="hidden text-[14px] font-[700] transition-all text-gray-400 hover:text-gray-600"
            @click.prevent="router.push('/search/pickleball'); setTab('explore');">
            {{ t('pickleball') }}
          </a>
        </nav>
      </div>

      <div class="flex items-center gap-2 md:gap-4">
        <button type="button" class="btn btn-nav-icon" @click="setDarkMode(!darkMode)">
          {{ darkMode ? '☀️' : '🌙' }}
        </button>

        <button type="button" class="btn btn-cta btn-cta-md hidden md:inline-flex px-4 py-2" @click="openFindEvents">
          {{ t('findEvents') }}
        </button>
        <div class="flex rounded-[8px] p-1 border"
          :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'">
          <button type="button" class="btn btn-sm rounded-[6px] px-2 md:px-3 py-1 text-[10px] md:text-[11px]"
            :class="language === 'zh' ? 'btn-cta' : 'btn-nav'" @click="setLanguage('zh')">
            中文
          </button>
          <button type="button" class="btn btn-sm rounded-[6px] px-2 md:px-3 py-1 text-[10px] md:text-[11px]"
            :class="language === 'en' ? 'btn-cta' : 'btn-nav'" @click="setLanguage('en')">
            EN
          </button>

        </div>
        <button type="button" class="btn btn-nav-icon" @click="onAdminClick" aria-label="Admin">
          🔑
        </button>
      </div>
    </div>
  </header>
</template>
