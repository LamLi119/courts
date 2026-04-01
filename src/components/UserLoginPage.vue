<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminLogin from './AdminLogin.vue';
import type { Language } from '../../types';
import { getAuthApiBase, useAuth } from '../composables/auth';
import { useAuthStore } from '../stores/auth';
import authSideImageUrl from '../assets/auth_side.png';

const logoUrl = `${import.meta.env.BASE_URL}green-G.svg`;

const props = defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  onAdminLogin: (password: string) => Promise<void>;
}>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { login, session, loading, error, clearError, user } = useAuth();
const showAdminLogin = ref(false);
const adminPassword = ref('');
const adminLoggingIn = ref(false);
const username = ref('');
const password = ref('');

const canSubmit = computed(() => username.value.trim().length > 0 && password.value.length > 0 && !loading.value);

async function checkSessionAndContinue() {
  clearError();
  const u = await session().catch(() => null);
  if (u) {
    const redirect = authStore.redirectPath && authStore.redirectPath !== '/' ? authStore.redirectPath : '/';
    authStore.setRedirectPath('/');
    router.push(redirect);
  }
}

async function submitUserLogin() {
  clearError();
  await login(username.value.trim(), password.value);
  const redirect = authStore.redirectPath && authStore.redirectPath !== '/' ? authStore.redirectPath : '/';
  authStore.setRedirectPath('/');
  router.push(redirect);
}

function openAdminLogin() {
  adminPassword.value = '';
  showAdminLogin.value = true;
}

async function handleAdminLogin() {
  if (adminLoggingIn.value) return;
  adminLoggingIn.value = true;
  try {
    await props.onAdminLogin(adminPassword.value);
    showAdminLogin.value = false;
    adminPassword.value = '';
  } finally {
    adminLoggingIn.value = false;
  }
}

const onSignInWithGoogle = () => {
  const apiBase = getAuthApiBase();
  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qs = new URLSearchParams({
    platform: 'courts',
    frontendUrl,
  });
  const googleSignInUrl = `${apiBase}/api/user/auth/google/start?${qs.toString()}`;
  window.location.href = googleSignInUrl;
}

const goToSignup = () => {
  const fromStore = authStore.redirectPath && authStore.redirectPath !== '/' ? authStore.redirectPath : '';
  const q = route.query.redirectUrl;
  const fromRoute =
    typeof q === 'string' && q.startsWith('/') && !q.startsWith('//') ? q : '';
  const redirect = fromStore || fromRoute;
  router.push(redirect ? { path: '/signup', query: { redirectUrl: redirect } } : '/signup');
};

onMounted(() => {
  const redirectUrl = route.query.redirectUrl as string | undefined;
  if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
    authStore.setRedirectPath(redirectUrl);
  }
  checkSessionAndContinue();
});
</script>

<template>
  <div class="min-h-screen grid grid-cols-1 md:grid-cols-2"
    :class="darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'">

    <!-- Left content (login UI) -->
    <div class="flex items-center justify-center px-4 py-10 pb-40">
      <!-- Top bar inside left box -->
      <div class="absolute w-full md:w-1/2 top-4 px-8 flex items-center justify-between">
        <button type="button" class="font-black text-sm opacity-70 hover:opacity-100 transition"
          @click="router.push('/')">
          ← {{ language === 'en' ? 'Back' : '返回' }}
        </button>

        <button type="button" class="px-3 py-2 rounded-lg font-black text-xs md:text-sm shadow-sm border transition"
          :class="darkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'"
          @click="openAdminLogin">
          {{ props.t('admin') }} {{ props.t('login') }}
        </button>
      </div>
      <div class="w-full max-w-md relative pt-12">
        <div class="flex items-center justify-center mb-6">
          <div
            class="w-30 h-30 transition-transform duration-300 group-hover:rotate-12 group-active:scale-90 flex items-center justify-center">
            <img :src="logoUrl" alt="TheGround.io" class="w-30 h-30" />
          </div>
        </div>

        <div class="p-6" :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'">
          <h2 class="text-2xl font-black tracking-tight mb-1">
            {{ language === 'en' ? 'Welcome Back!' : '歡迎回來！' }}
          </h2>
          <p class="text-sm font-bold opacity-60 mb-6">
            {{ language === 'en' ? 'Sign in to unlock special offers.' : '登入以解鎖特別優惠。' }}
          </p>

          <!-- Google Sign In (not wired yet) -->
          <!-- google login button (https://developers.google.com/identity/branding-guidelines?hl=zh-tw) -->
          <div class="flex justify-center items-center">
            <button id="google-sign-in-button" class="gsi-material-button" style="width: 1000px" @click="onSignInWithGoogle">
              <div class="gsi-material-button-state"></div>
              <div class="gsi-material-button-content-wrapper">
                <div class="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"
                    xmlns:xlink="http://www.w3.org/1999/xlink" style="display: block;">
                    <path fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z">
                    </path>
                    <path fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z">
                    </path>
                    <path fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z">
                    </path>
                    <path fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z">
                    </path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span class="gsi-material-button-contents">{{
                  language === 'en' ? 'Sign in with Google' : '使用 Google 登入'
                  }}</span>
                <span style="display: none">{{
                  language === 'en' ? 'Sign in with Google' : '使用 Google 登入'
                  }}</span>
              </div>
            </button>
          </div>

          <!-- Divider -->
          <div class="mt-4 mb-4 flex items-center gap-4">
            <div class="h-px flex-1" :class="darkMode ? 'bg-gray-700' : 'bg-gray-300'" />
            <span class="text-sm font-bold" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">or</span>
            <div class="h-px flex-1" :class="darkMode ? 'bg-gray-700' : 'bg-gray-300'" />
          </div>

          <form class="space-y-4" @submit.prevent="submitUserLogin">
            <div class="space-y-1">
              <label class="text-xs font-black uppercase tracking-wider opacity-70">
                {{ language === 'en' ? 'Username / Email' : '用戶名 / 電郵' }}
              </label>
              <input v-model="username" type="text" autocomplete="username"
                class="w-full px-4 py-3 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-[#007a67]"
                :class="darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
                @input="clearError" />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-black uppercase tracking-wider opacity-70">
                {{ language === 'en' ? 'Password' : '密碼' }}
              </label>
              <input v-model="password" type="password" autocomplete="current-password"
                class="w-full px-4 py-3 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-[#007a67]"
                :class="darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
                @input="clearError" />
            </div>

            <!-- Forgot password (send to theground.io for now) -->
            <div class="text-right">
              <a href="https://www.theground.io/forgetPassword" target="_blank" rel="noopener noreferrer"
                class="text-[14px] font-bold text-[#007a67] underline">
                {{ language === 'en' ? 'Forgot Username/Password?' : '忘記用戶名/密碼？' }}
              </a>
            </div>

            <button type="submit" id="sign-in-button" class="w-full py-3 rounded-xl font-black shadow-sm transition-all active:scale-[0.99]"
              :class="canSubmit ? 'bg-[#007a67] text-white hover:brightness-110' : (darkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')"
              :disabled="!canSubmit">
              {{ loading ? (language === 'en' ? 'Signing in…' : '登入中…') : (language === 'en' ? 'Sign in' : '登入') }}
            </button>

            <!--<button
            type="button"
            class="w-full py-3 rounded-xl font-black shadow-sm border transition-all active:scale-[0.99]"
            :class="darkMode ? 'bg-gray-900 border-gray-700 hover:bg-gray-800' : 'bg-white border-gray-200 hover:bg-gray-50'"
            :disabled="loading"
            @click="checkSessionAndContinue"
          >
            {{ language === 'en' ? 'I already logged in' : '我已登入' }}
          </button>-->

            <p v-if="error" class="text-sm font-bold text-red-500">
              {{ error }}
            </p>

            <p v-if="user" class="text-sm font-bold opacity-70">
              {{ language === 'en' ? 'Logged in as' : '已登入為' }} {{ user.name }}
            </p>

            <!-- Footer -->
            <div class="text-center pt-2">
              <span class="text-[16px] font-bold leading-none">
                {{ language === 'en' ? 'Don\'t have an account?' : '未有帳戶？' }}
              </span>
              <a href="/signup" class="text-[14px] font-bold text-[#007a67] underline"
                @click.prevent="goToSignup">
                {{ language === 'en' ? 'Sign up' : '註冊' }}
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Right image (hidden on mobile, shows on md+) -->
    <div class="hidden md:block relative min-h-screen">
      <div class="absolute inset-0 bg-cover bg-center" :style="{ backgroundImage: `url(${authSideImageUrl})` }" />
      <!-- optional overlay for readability -->
      <div class="absolute inset-0" :class="darkMode ? 'bg-black/30' : 'bg-black/10'" />
    </div>

    <AdminLogin v-if="showAdminLogin" :password="adminPassword" :setPassword="(val: string) => { adminPassword = val; }"
      :onLogin="handleAdminLogin" :onClose="() => { showAdminLogin = false; }" :language="language" :t="t"
      :darkMode="darkMode" :isLoading="adminLoggingIn" />
  </div>
</template>

<style lang="css" scoped>
/* google login button styles (https://developers.google.com/identity/branding-guidelines?hl=zh-tw) */
.gsi-material-button {
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  -webkit-appearance: none;
  background-color: WHITE;
  background-image: none;
  border: 1px solid #747775;
  -webkit-border-radius: 20px;
  border-radius: 20px;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  color: #1f1f1f;
  cursor: pointer;
  font-family: 'Roboto', arial, sans-serif;
  font-size: 14px;
  height: 40px;
  letter-spacing: 0.25px;
  outline: none;
  overflow: hidden;
  padding: 0 12px;
  position: relative;
  text-align: center;
  -webkit-transition: background-color 0.218s, border-color 0.218s,
    box-shadow 0.218s;
  transition: background-color 0.218s, border-color 0.218s, box-shadow 0.218s;
  vertical-align: middle;
  white-space: nowrap;
  width: auto;
  max-width: 1000px;
  min-width: min-content;
}

.gsi-material-button .gsi-material-button-icon {
  height: 20px;
  margin-right: 10px;
  min-width: 20px;
  width: 20px;
}

.gsi-material-button .gsi-material-button-content-wrapper {
  -webkit-align-items: center;
  align-items: center;
  display: flex;
  -webkit-flex-direction: row;
  flex-direction: row;
  -webkit-flex-wrap: nowrap;
  flex-wrap: nowrap;
  height: 100%;
  justify-content: center;
  position: relative;
  width: 100%;
}

.gsi-material-button .gsi-material-button-contents {
  -webkit-flex-grow: 0;
  flex-grow: 0;
  font-family: 'Roboto', arial, sans-serif;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: top;
}

.gsi-material-button .gsi-material-button-state {
  -webkit-transition: opacity 0.218s;
  transition: opacity 0.218s;
  bottom: 0;
  left: 0;
  opacity: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.gsi-material-button:disabled {
  cursor: default;
  background-color: #ffffff61;
  border-color: #1f1f1f1f;
}

.gsi-material-button:disabled .gsi-material-button-contents {
  opacity: 38%;
}

.gsi-material-button:disabled .gsi-material-button-icon {
  opacity: 38%;
}

.gsi-material-button:not(:disabled):active .gsi-material-button-state,
.gsi-material-button:not(:disabled):focus .gsi-material-button-state {
  background-color: #303030;
  opacity: 12%;
}

.gsi-material-button:not(:disabled):hover {
  -webkit-box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3),
    0 1px 3px 1px rgba(60, 64, 67, 0.15);
  box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3),
    0 1px 3px 1px rgba(60, 64, 67, 0.15);
}

.gsi-material-button:not(:disabled):hover .gsi-material-button-state {
  background-color: #303030;
  opacity: 8%;
}
</style>