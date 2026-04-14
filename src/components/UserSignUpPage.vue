<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Language } from '../../types';
import { useAuth } from '../composables/auth';
import { useAuthStore } from '../stores/auth';
import IntlTelInputWrapper from './IntlTelInputWrapper.vue';
import authSideImageUrl from '../assets/auth_side.png';

const logoUrl = `${import.meta.env.BASE_URL}green-G.svg`;

const props = defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
}>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { register, loading } = useAuth();

const email = ref('');
const name = ref('');
const loginId = ref('');
const countryCode = ref('852');
const phoneNo = ref('');
const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const isPhoneValid = ref(false);

const canSubmit = computed(() =>
  email.value.trim().length > 0
  && name.value.trim().length > 0
  && loginId.value.trim().length > 0
  && phoneNo.value.trim().length > 0
  && password.value.length > 0
  && confirmPassword.value.length > 0
  && !loading.value
);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function submitSignUp() {
  error.value = '';

  const payload = {
    email: email.value.trim(),
    name: name.value.trim(),
    loginId: loginId.value.trim(),
    phoneNo: phoneNo.value.trim(),
    password: password.value,
    type: 'courts',
    country_code: countryCode.value,
    description: '',
    page: '',
  };

  if (!emailRegex.test(payload.email)) {
    error.value = props.language === 'en' ? 'Please enter a valid email address.' : '請輸入有效電郵地址。';
    return;
  }
  if (!payload.phoneNo) {
    error.value = props.language === 'en' ? 'Phone number is required.' : '電話號碼為必填。';
    return;
  }
  if (!isPhoneValid.value) {
    error.value = props.language === 'en' ? 'Please enter a valid phone number.' : '請輸入有效電話號碼。';
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = props.language === 'en' ? 'Passwords do not match.' : '兩次輸入的密碼不一致。';
    return;
  }

  try {
    await register(payload);
    const redirect = authStore.redirectPath && authStore.redirectPath !== '/' ? authStore.redirectPath : '/';
    authStore.setRedirectPath('/');
    router.push(redirect);
  } catch (e: any) {
    error.value = e?.message || (props.language === 'en' ? 'Registration failed.' : '註冊失敗。');
  }
}

onMounted(() => {
  const redirectUrl = route.query.redirectUrl as string | undefined;
  if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
    authStore.setRedirectPath(redirectUrl);
  }
});

const safeRedirectQuery = computed(() => {
  const r = route.query.redirectUrl;
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '';
});

function goToLoginPage() {
  const r = safeRedirectQuery.value;
  router.push(r ? { path: '/login', query: { redirectUrl: r } } : '/login');
}

</script>

<template>
  <div class="min-h-screen grid grid-cols-1 md:grid-cols-2" :class="darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'">
    <div class="flex items-center justify-center px-4 py-10 pb-40">
      <div class="absolute w-full md:w-1/2 top-4 px-8 flex items-center justify-between">
        <button type="button" class="font-black text-sm opacity-70 hover:opacity-100 transition" @click="goToLoginPage">
          ← {{ language === 'en' ? 'Back' : '返回' }}
        </button>
      </div>

      <div class="w-full max-w-md relative pt-12">
        <div class="flex items-center justify-center mb-6">
          <div class="w-30 h-30 flex items-center justify-center">
            <img :src="logoUrl" alt="TheGround.io" class="w-30 h-30" />
          </div>
        </div>

        <div class="p-6" :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'">
          <h2 class="text-2xl font-black tracking-tight mb-1">
            {{ language === 'en' ? 'Create an account' : '建立帳戶' }}
          </h2>
          <p class="text-sm font-bold opacity-60 mb-6">
            {{ language === 'en' ? 'Join to unlock special offers.' : '註冊以解鎖特別優惠。' }}
          </p>

          <form class="space-y-4" @submit.prevent="submitSignUp">
            <div class="space-y-1">
              <label class="text-xs font-black uppercase tracking-wider opacity-70">Email</label>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                class="w-full px-4 py-3 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-[#007a67]"
                :class="darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-black uppercase tracking-wider opacity-70">
                {{ language === 'en' ? 'Display Name' : '顯示名稱' }}
              </label>
              <input
                v-model="name"
                type="text"
                autocomplete="name"
                class="w-full px-4 py-3 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-[#007a67]"
                :class="darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-black uppercase tracking-wider opacity-70">Username</label>
              <input
                v-model="loginId"
                type="text"
                autocomplete="username"
                class="w-full px-4 py-3 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-[#007a67]"
                :class="darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-black uppercase tracking-wider opacity-70">
                {{ language === 'en' ? 'Phone number *' : '電話號碼 *' }}
              </label>
              <div
                class="w-full rounded-xl border shadow-sm"
                :class="darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
              >
                <IntlTelInputWrapper
                  v-model:countryCode="countryCode"
                  v-model:phoneNumber="phoneNo"
                  :darkMode="darkMode"
                  @update:is-valid="(val) => { isPhoneValid = val; }"
                  @validate="(val) => { isPhoneValid = val; }"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-xs font-black uppercase tracking-wider opacity-70">
                {{ language === 'en' ? 'Password' : '密碼' }}
              </label>
              <input
                v-model="password"
                type="password"
                autocomplete="new-password"
                class="w-full px-4 py-3 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-[#007a67]"
                :class="darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-black uppercase tracking-wider opacity-70">
                {{ language === 'en' ? 'Confirm Password' : '確認密碼' }}
              </label>
              <input
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                class="w-full px-4 py-3 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-[#007a67]"
                :class="darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
              />
            </div>

            <button
              type="submit"
              id="sign-up-button"
              class="w-full py-3 rounded-xl font-black shadow-sm transition-all active:scale-[0.99]"
              :class="canSubmit ? 'bg-[#007a67] text-white hover:brightness-110' : (darkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')"
              :disabled="!canSubmit"
            >
              {{ loading ? (language === 'en' ? 'Signing up...' : '註冊中...') : (language === 'en' ? 'Sign up' : '註冊') }}
            </button>

            <p v-if="error" class="text-sm font-bold text-red-500">
              {{ error }}
            </p>

            <div class="text-center text-sm font-bold opacity-70 pt-2">
              <span>
                {{ language === 'en' ? "By continuing, you agree to TheGround's " : '繼續即表示你同意 TheGround 的 ' }}
              </span>
              <a
                href="https://join.theground.io/terms"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[#007a67] underline hover:brightness-110"
              >
                {{ language === 'en' ? 'Terms of Service' : '服務條款' }}
              </a>
              <span>{{ language === 'en' ? ' and ' : ' 及 ' }}</span>
              <a
                href="https://join.theground.io/privacy"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[#007a67] underline hover:brightness-110"
              >
                {{ language === 'en' ? 'Privacy Policy' : '私隱政策' }}
              </a>
              <span>.</span>
            </div>

            <div class="text-center pt-2">
              <span class="text-[16px] font-bold leading-none">
                {{ language === 'en' ? 'Already have an account?' : '已有帳戶？' }}
              </span>
              <a href="/login" class="text-[14px] font-bold text-[#007a67] underline" @click.prevent="goToLoginPage">
                {{ language === 'en' ? 'Sign in' : '登入' }}
              </a>
            </div>            
          </form>
        </div>
      </div>
    </div>

    <div class="hidden md:block relative min-h-screen">
      <div class="absolute inset-0 bg-cover bg-center" :style="{ backgroundImage: `url(${authSideImageUrl})` }" />
      <div class="absolute inset-0" :class="darkMode ? 'bg-black/30' : 'bg-black/10'" />
    </div>
  </div>
</template>
