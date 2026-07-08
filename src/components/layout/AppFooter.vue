<script setup lang="ts">
import { ref } from 'vue';
import type { Language } from '../../../types';

const props = defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  variant?: 'overlay' | 'inline' | 'landing';
  setLanguage?: (l: Language) => void;
}>();

const CONTACT_EMAIL = 'info@theground.io';
const CONTACT_PHONE = '';
const shareFeedback = ref<string | null>(null);

const footerLinks = [
  { key: 'aboutUs', href: 'https://join.theground.io' },
  { key: 'termsOfService', href: 'https://join.theground.io/terms' },
  { key: 'privacyPolicy', href: 'https://join.theground.io/privacy' },
] as const;

async function handleShare() {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const title = props.t('footerBrand');
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
    } else {
      await navigator.clipboard.writeText(url);
      shareFeedback.value = props.t('linkCopied');
      setTimeout(() => { shareFeedback.value = null; }, 2000);
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      try {
        await navigator.clipboard.writeText(url);
        shareFeedback.value = props.t('linkCopied');
        setTimeout(() => { shareFeedback.value = null; }, 2000);
      } catch (_) {
        /* ignore */
      }
    }
  }
}

function toggleLanguage() {
  if (props.setLanguage) {
    props.setLanguage(props.language === 'en' ? 'zh' : 'en');
  }
}
</script>

<template>
  <!-- Landing page footer (dark, 3-column layout) -->
  <footer
    v-if="variant === 'landing'"
    class="w-full bg-[#0f172a] text-gray-300 border-t border-gray-800"
  >
    <div class="w-full max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-12">
      <div class="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div class="shrink-0">
          <p class="text-lg md:text-xl font-black text-white tracking-tight">
            {{ t('footerBrand') }}
          </p>
          <p class="mt-2 text-xs md:text-sm text-gray-400">
            {{ t('footerCopyright') }}
          </p>
          <a
            :href="`mailto:${CONTACT_EMAIL}`"
            class="mt-3 inline-flex items-center gap-1 text-[10px] md:text-xs text-gray-400 hover:text-[#007a67] transition-colors"
          >
            <span>{{ t('contactSupport') }}:</span>
            <span class="font-semibold underline-offset-2 hover:underline">{{ CONTACT_EMAIL }}</span>
          </a>
        </div>

        <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-gray-400">
          <a
            v-for="link in footerLinks"
            :key="link.key"
            :href="link.href"
            class="hover:text-white transition-colors"
            :target="link.href.startsWith('mailto:') ? undefined : '_blank'"
            :rel="link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'"
          >
            {{ t(link.key) }}
          </a>
        </nav>

        <div class="flex items-center justify-center lg:justify-end gap-4 shrink-0">
          <button
            type="button"
            class="w-10 h-10 rounded-full border border-gray-600 flex items-center justify-center text-gray-300 hover:text-white hover:border-gray-400 transition-colors"
            :title="t('share')"
            :aria-label="t('share')"
            @click="handleShare"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          <a
            :href="`mailto:${CONTACT_EMAIL}`"
            class="flex flex-col items-center gap-1 group"
            :title="t('contactSupport')"
            :aria-label="t('contactSupport')"
          >
            <span class="w-10 h-10 rounded-full border border-gray-600 flex items-center justify-center text-gray-300 group-hover:text-white group-hover:border-gray-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            
          </a>
        </div>
      </div>

      <p v-if="shareFeedback" class="mt-4 text-center text-xs text-[#007a67] font-semibold">
        {{ shareFeedback }}
      </p>
    </div>
  </footer>

  <!-- Default footer (explore / inline) -->
  <footer
    v-else
    class="text-center text-[11px] leading-relaxed"
    :class="[
      variant === 'overlay'
        ? 'absolute bottom-3 left-3 right-3 z-20 pointer-events-auto rounded-[10px] px-3 py-2.5 shadow-md backdrop-blur'
        : 'px-4 py-6 border-t',
      variant === 'overlay'
        ? (darkMode ? 'bg-gray-900/90 border border-gray-700 text-gray-400' : 'bg-white/90 border border-gray-200 text-gray-500')
        : (darkMode ? 'border-gray-800 text-gray-500' : 'border-gray-200 text-gray-500'),
    ]"
  >
    <div class="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <p class="font-bold text-[12px]" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
        {{ t('connectUs') }}
      </p>
      <a :href="`mailto:${CONTACT_EMAIL}`" class="font-semibold text-[#007a67] hover:underline">
        {{ CONTACT_EMAIL }}
      </a>
      <template v-if="CONTACT_PHONE">
        <span class="opacity-40" aria-hidden="true">·</span>
        <a class="font-semibold text-[#007a67] hover:underline">
          {{ CONTACT_PHONE }}
        </a>
      </template>
    </div>

    <p class="mt-2 opacity-80 max-w-md mx-auto">
      {{ t('referenceDisclaimer') }}
    </p>
  </footer>
</template>
