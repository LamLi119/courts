<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Language } from '../../types';
import { useAuth } from '../composables/auth';
import { useAuthStore } from '../stores/auth';
import authSideImageUrl from '../assets/auth_side.png';

const props = defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
}>();

const router = useRouter();
const authStore = useAuthStore();
const { session, loading } = useAuth();

const accessToken = ref('');
const refreshToken = ref('');
const error = ref('');
const autoLoginTriggered = ref(false);

async function saveAndLogin() {
  error.value = '';
  try {
    const at = accessToken.value.trim();
    const rt = refreshToken.value.trim();

    localStorage.setItem('theground_access_token', at);
    if (rt) localStorage.setItem('theground_refresh_token', rt);
    else localStorage.removeItem('theground_refresh_token');

    const u = await session();
    if (!u) throw new Error(props.language === 'en' ? 'Invalid token' : 'Token 無效');
    const phone = (u.phoneNo || '').toString().trim();
    if (!phone) {
      router.push('/complete-phone');
      return;
    }
    const redirect = authStore.redirectPath && authStore.redirectPath !== '/' ? authStore.redirectPath : '/';
    authStore.setRedirectPath('/');
    router.push(redirect);
  } catch (e: any) {
    error.value = e?.message || (props.language === 'en' ? 'Login failed' : '登入失敗');
  }
}

function parseTokenFromLocation(): { accessToken?: string; refreshToken?: string } {
  if (typeof window === 'undefined') return {};

  // Prefer URL hash to reduce accidental server logging/referrer leakage.
  // Example: /token-login#accessToken=...&refreshToken=...
  const hash = (window.location.hash || '').replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);
  const at =
    hashParams.get('accessToken')
    || hashParams.get('access_token')
    || hashParams.get('token')
    || hashParams.get('jwt')
    || undefined;
  const rt = hashParams.get('refreshToken') || hashParams.get('refresh_token') || undefined;
  if (at || rt) return { accessToken: at || undefined, refreshToken: rt || undefined };

  // Fallback: query string (less ideal; some OAuth flows use ?token=)
  const qs = new URLSearchParams(window.location.search || '');
  return {
    accessToken:
      qs.get('accessToken')
      || qs.get('access_token')
      || qs.get('token')
      || qs.get('jwt')
      || undefined,
    refreshToken: qs.get('refreshToken') || qs.get('refresh_token') || undefined,
  };
}

onMounted(() => {
  const parsed = parseTokenFromLocation();
  if (parsed.accessToken) accessToken.value = parsed.accessToken;
  if (parsed.refreshToken) refreshToken.value = parsed.refreshToken;
  const hash = typeof window !== 'undefined' ? (window.location.hash || '').replace(/^#/, '') : '';
  const hashParams = new URLSearchParams(hash);
  const hashError = hashParams.get('error') || hashParams.get('message');
  if (hashError) error.value = hashError;

  if (parsed.accessToken) {
    autoLoginTriggered.value = true;
    saveAndLogin();
  } else if (!hashError) {
    router.replace('/login');
  }
});
</script>

<template>
  <div
    class="min-h-screen grid grid-cols-1 md:grid-cols-2"
    :class="darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'"
  >
    <!-- Left: completing auth, error from OAuth, or brief redirect -->
    <div
      class="relative flex min-h-screen flex-col"
      :class="darkMode ? 'md:bg-gray-900' : 'md:bg-white'"
    >
      <div
        class="absolute top-4 z-10 flex w-full items-center justify-between px-6 md:w-1/2 md:px-8"
      >
        <button
          type="button"
          class="font-black text-sm opacity-70 transition hover:opacity-100"
          @click="router.push('/login')"
        >
          ← {{ language === 'en' ? 'Back' : '返回' }}
        </button>
      </div>

      <div class="flex flex-1 items-center justify-center px-4 py-16 md:py-10">
        <div
          v-if="autoLoginTriggered && loading"
          class="flex flex-col items-center justify-center text-center"
        >
          <svg
            class="h-10 w-10 shrink-0 text-[#007a67] motion-safe:animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.75"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          <p
            class="mt-4 max-w-sm text-[15px] font-medium leading-snug"
            :class="darkMode ? 'text-gray-300' : 'text-[#2d3748]'"
          >
            {{
              language === 'en'
                ? 'Completing authentication...'
                : '正在完成驗證...'
            }}
          </p>
        </div>

        <div
          v-else-if="error"
          class="max-w-md px-2 text-center"
        >
          <p class="text-sm font-bold text-red-500">
            {{ error }}
          </p>
          <button
            type="button"
            class="mt-6 text-sm font-black text-[#007a67] underline"
            @click="router.push('/login')"
          >
            {{ language === 'en' ? 'Back to sign in' : '返回登入' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Right: venue photo (md+) -->
    <div class="relative hidden min-h-[40vh] md:block md:min-h-screen">
      <div
        class="absolute inset-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${authSideImageUrl})` }"
      />
      <div
        class="absolute inset-0"
        :class="darkMode ? 'bg-black/30' : 'bg-black/10'"
      />
    </div>
  </div>
</template>

