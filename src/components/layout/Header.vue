<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { computed, ref } from 'vue';
import type { Language, AppTab } from '../../../types';

const router = useRouter();
const route = useRoute();

const isHome = computed(() => route.name === 'home');
const mobileNavOpen = ref(false);

const logoUrl = `${import.meta.env.BASE_URL}green-G.svg`;

const props = defineProps<{
  language: Language;
  setLanguage: (l: Language) => void;
  isAdmin: boolean;
  onAdminClick: () => void;
  onLoginClick: () => void;
  onLogout?: () => void;
  showLogout?: boolean;
  onUserLogout?: () => void | Promise<void>;
  darkMode: boolean;
  setDarkMode: (d: boolean) => void;
  t: (key: string) => string;
  currentTab: AppTab;
  setTab: (t: AppTab) => void;
  viewMode?: 'map' | 'list';
  setViewMode?: (mode: 'map' | 'list') => void;
  hideNavTabs?: boolean;
  filterSpecialOffer?: boolean;
  setFilterSpecialOffer?: (v: boolean) => void;
}>();

const goHome = () => {
  mobileNavOpen.value = false;
  router.push('/');
};

const openFindEvents = () => {
  mobileNavOpen.value = false;
  window.open('https://www.theground.io', '_blank');
};

function closeMobileNav() {
  mobileNavOpen.value = false;
}

function navToExplore() {
  closeMobileNav();
  router.push('/explore');
  props.setTab('explore');
}

function navToAbout() {
  closeMobileNav();
  router.push('/about');
}

function navToBlog() {
  closeMobileNav();
  router.push('/blog');
}

function toggleDarkFromMenu() {
  props.setDarkMode(!props.darkMode);
}

function setLangFromMenu(lang: Language) {
  props.setLanguage(lang);
}
</script>

<template>
  <header :class="[
    'sticky top-0 z-[60] w-full backdrop-blur-md border-b shadow-sm',
    darkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200'
  ]">
    <div class="w-full max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 md:gap-8 min-w-0">
        <a href="/" class="flex items-center gap-2.5 cursor-pointer group shrink-0 no-underline" @click.prevent="goHome">
          <div
            class="w-10 h-10 transition-transform duration-300 group-hover:rotate-12 group-active:scale-90 flex items-center justify-center">
            <img :src="logoUrl" alt="Courts by The Ground" class="w-10 h-10" />
          </div>
          <span class="hidden sm:block text-[20px] font-[900] tracking-tighter text-[#007a67]">
            Courts
          </span>
        </a>

        <nav v-if="!hideNavTabs" class="hidden lg:flex items-center gap-3 xl:gap-6">
          <a
            href="/"
            class="btn btn-nav no-underline"
            :class="isHome ? 'btn-nav-active' : ''"
            @click.prevent="goHome"
          >
            {{ t('home') }}
          </a>
          <a
            href="/explore"
            class="btn btn-nav no-underline"
            :class="!isHome && currentTab === 'explore' ? 'btn-nav-active' : ''"
            @click.prevent="navToExplore"
          >
            {{ t('explore') }}
          </a>
          <a
            href="/blog"
            class="btn btn-nav no-underline"
            :class="route.name === 'blog' || route.name === 'blog-post' ? 'btn-nav-active' : ''"
            @click.prevent="navToBlog"
          >
            {{ t('blog') }}
          </a>
          <button type="button" class="btn btn-nav min-h-[44px]"
            :class="currentTab === 'saved' ? 'text-red-500' : ''" @click="setTab('saved')">
            {{ t('saved') }}
          </button>
        </nav>
      </div>

      <div class="flex items-center gap-2 md:gap-4 shrink-0">
        <!-- Desktop only (lg+): theme, find events, language -->
        <button type="button" class="btn btn-nav-icon min-h-[44px] min-w-[44px] hidden lg:inline-flex" @click="setDarkMode(!darkMode)" :aria-label="darkMode ? 'Light mode' : 'Dark mode'">
          {{ darkMode ? '☀️' : '🌙' }}
        </button>

        <button type="button" id="find-events-button" class="btn btn-cta btn-cta-md hidden lg:inline-flex px-4 py-2 min-h-[44px]" @click="openFindEvents">
          {{ t('findEvents') }}
        </button>

        <div class="hidden lg:flex rounded-[8px] p-1 border items-center"
          :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'">
          <button type="button" class="btn btn-sm rounded-[6px] min-h-[44px] min-w-[44px] px-2 md:px-3 text-[11px] md:text-[12px]"
            :class="language === 'zh' ? 'btn-cta' : 'btn-nav'" @click="setLanguage('zh')" aria-label="中文">
            中文
          </button>
          <button type="button" class="btn btn-sm rounded-[6px] min-h-[44px] min-w-[44px] px-2 md:px-3 text-[11px] md:text-[12px]"
            :class="language === 'en' ? 'btn-cta' : 'btn-nav'" @click="setLanguage('en')">
            EN
          </button>
        </div>

        <!-- Mobile: hamburger to the right of Login -->
        <button
          v-if="showLogout"
          type="button"
          class="btn btn-error btn-error-md px-4 py-2 min-h-[44px] hidden lg:inline-flex"
          @click="onUserLogout && onUserLogout()"
        >
          {{ t('logout') }}
        </button>
        <button
          v-if="!showLogout && !isAdmin"
          type="button"
          class="btn btn-cta btn-cta-md px-4 py-2 min-h-[44px]"
          @click="onLoginClick"
          aria-label="Login"
        >
          {{ t('login') }}
        </button>
        <button
          type="button"
          class="btn btn-nav-icon min-h-[44px] min-w-[44px] lg:!hidden"
          :aria-expanded="mobileNavOpen"
          aria-controls="mobile-main-nav"
          :aria-label="language === 'zh' ? '主選單' : 'Main menu'"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          {{ mobileNavOpen ? '✕' : '☰' }}
        </button>
        <button v-if="!showLogout && isAdmin" type="button" class="btn btn-nav-icon min-h-[44px] min-w-[44px] hidden lg:inline-flex" @click="onAdminClick" aria-label="Admin">
          🔑
        </button>
      </div>
    </div>

    <nav
      v-if="mobileNavOpen"
      id="mobile-main-nav"
      class="lg:hidden border-t px-4 py-3 flex flex-col gap-1"
      :class="darkMode ? 'border-gray-800 bg-gray-900/95' : 'border-gray-100 bg-white/95'"
    >
      <a href="/" class="btn btn-nav justify-start no-underline min-h-[44px]" :class="isHome ? 'btn-nav-active' : ''" @click.prevent="goHome">{{ t('home') }}</a>
      <a href="/explore" class="btn btn-nav justify-start no-underline min-h-[44px]" @click.prevent="navToExplore">{{ t('explore') }}</a>
      <a href="/blog" class="btn btn-nav justify-start no-underline min-h-[44px]" @click.prevent="navToBlog">{{ t('blog') }}</a>
      <button type="button" class="btn btn-nav justify-start min-h-[44px]" @click="openFindEvents">{{ t('findEvents') }}</button>
      <a href="/about" class="btn btn-nav justify-start no-underline min-h-[44px]" @click.prevent="navToAbout">{{ t('aboutUs') }}</a>
      <button type="button" class="btn btn-nav justify-start min-h-[44px]" @click="toggleDarkFromMenu">
        {{ darkMode ? (language === 'zh' ? '淺色模式' : 'Light mode') : (language === 'zh' ? '深色模式' : 'Dark mode') }}
      </button>
      <div class="flex gap-2 pt-1">
        <button type="button" class="btn btn-sm flex-1 min-h-[44px] rounded-[8px]"
          :class="language === 'zh' ? 'btn-cta' : 'btn-nav'" @click="setLangFromMenu('zh')">中文</button>
        <button type="button" class="btn btn-sm flex-1 min-h-[44px] rounded-[8px]"
          :class="language === 'en' ? 'btn-cta' : 'btn-nav'" @click="setLangFromMenu('en')">EN</button>
      </div>
    </nav>
  </header>
</template>
