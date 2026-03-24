<script setup lang="ts">
import type { Language } from '../../types';

const props = defineProps<{
  password: string;
  setPassword: (val: string) => void;
  onLogin: () => void;
  onClose: () => void;
  isLoading?: boolean;
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
}>();
</script>

<template>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="admin-login-title"
    class="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4"
  >
    <div
      class="rounded-[16px] p-6 max-w-md w-full shadow-2xl transition-all"
      :class="darkMode ? 'bg-gray-800' : 'bg-white'"
    >
      <h2
        id="admin-login-title"
        class="text-[24px] font-[900] mb-4"
        :class="darkMode ? 'text-white' : 'text-gray-900'"
      >
        {{ t('admin') }} {{ t('login') }}
      </h2>
      <input
        type="password"
        :value="password"
        @input="e => setPassword((e.target as HTMLInputElement).value)"
        @keydown.enter="() => { if (!isLoading) onLogin(); }"
        :placeholder="language === 'en' ? 'Enter password' : '輸入密碼'"
        class="w-full px-4 py-2 border rounded-[8px] mb-4 focus:ring-2 focus:ring-[#007a67] focus:outline-none transition-all"
        :class="darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'"
        :disabled="isLoading"
        autofocus
      />
      <div class="flex gap-2">
        <button
          @click="onLogin"
          :disabled="isLoading"
          class="flex-1 px-4 py-2 bg-[#007a67] text-white rounded-[8px] font-[900] hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ isLoading ? (language === 'en' ? 'Logging in...' : '登入中...') : t('login') }}
        </button>
        <button
          @click="onClose"
          :disabled="isLoading"
          class="flex-1 px-4 py-2 rounded-[8px] font-[700] transition-all"
          :class="darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
        >
          {{ t('cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

