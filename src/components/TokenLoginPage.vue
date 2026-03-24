<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Language } from '../../types';
import { useAuth } from '../composables/auth';

const props = defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
}>();

const router = useRouter();
const { session, loading } = useAuth();

const accessToken = ref('');
const refreshToken = ref('');
const error = ref('');
const autoLoginTriggered = ref(false);

const canSubmit = computed(() => accessToken.value.trim().length > 0 && !loading.value);

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
    router.push('/');
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

  // Auto-login when accessToken is provided via URL.
  if (parsed.accessToken) {
    autoLoginTriggered.value = true;
    saveAndLogin();
  }
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-10" :class="darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'">
    <div class="w-full max-w-xl">
      <div class="flex items-center justify-between mb-6">
        <button
          type="button"
          class="font-black text-sm opacity-70 hover:opacity-100 transition"
          @click="router.push('/login')"
        >
          ← {{ language === 'en' ? 'Back' : '返回' }}
        </button>
      </div>

      <div class="rounded-3xl border shadow-lg p-6" :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'">
        <h2 class="text-2xl font-black tracking-tight mb-1">
          {{ language === 'en' ? 'Paste token' : '貼上 Token 登入' }}
        </h2>
        <p class="text-sm font-bold opacity-60 mb-6">
          {{ language === 'en' ? 'For internal/testing use only.' : '只建議內部/測試使用。' }}
        </p>
        <p
          v-if="autoLoginTriggered && loading"
          class="text-sm font-bold text-[#007a67] mb-4"
        >
          {{ language === 'en' ? 'Google sign-in in progress...' : 'Google 登入中...' }}
        </p>

        <div class="space-y-4">
          <div class="space-y-1">
            <label class="text-xs font-black uppercase tracking-wider opacity-70">
              accessToken
            </label>
            <textarea
              v-model="accessToken"
              rows="6"
              class="w-full px-4 py-3 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-[#007a67]"
              :class="darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
              placeholder="Paste accessToken here"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-black uppercase tracking-wider opacity-70">
              refreshToken (optional)
            </label>
            <textarea
              v-model="refreshToken"
              rows="3"
              class="w-full px-4 py-3 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-[#007a67]"
              :class="darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
              placeholder="Paste refreshToken here (optional)"
            />
          </div>

          <button
            type="button"
            class="w-full py-3 rounded-xl font-black shadow-xl transition-all active:scale-[0.99]"
            :class="canSubmit ? 'bg-[#007a67] text-white hover:brightness-110' : (darkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')"
            :disabled="!canSubmit"
            @click="saveAndLogin"
          >
            {{ loading ? (language === 'en' ? 'Logging in…' : '登入中…') : (language === 'en' ? 'Save & Login' : '保存並登入') }}
          </button>

          <p v-if="error" class="text-sm font-bold text-red-500">
            {{ error }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

