<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Language } from '../../types';
import { useAuth } from '../composables/auth';
import { useAuthStore } from '../stores/auth';
import IntlTelInputWrapper from './IntlTelInputWrapper.vue';
import authSideImageUrl from '../assets/auth_side.png';

const props = defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
}>();

const router = useRouter();
const authStore = useAuthStore();
const { completePhone, loading, session } = useAuth();

const countryCode = ref('852');
const phoneNo = ref('');
const isPhoneValid = ref(false);
const error = ref('');

const canSubmit = computed(() =>
  phoneNo.value.trim().length > 0 && isPhoneValid.value && !loading.value
);

async function submitPhone() {
  error.value = '';
  if (!phoneNo.value.trim()) {
    error.value = props.language === 'en' ? 'Phone number is required.' : '電話號碼為必填。';
    return;
  }
  if (!isPhoneValid.value) {
    error.value = props.language === 'en' ? 'Please enter a valid phone number.' : '請輸入有效電話號碼。';
    return;
  }

  try {
    await completePhone({
      phoneNo: phoneNo.value.trim(),
      country_code: countryCode.value,
    });
    const redirect = authStore.redirectPath && authStore.redirectPath !== '/' ? authStore.redirectPath : '/';
    authStore.setRedirectPath('/');
    router.push(redirect);
  } catch (e: any) {
    error.value = e?.message || (props.language === 'en' ? 'Failed to save phone number.' : '儲存電話號碼失敗。');
  }
}

onMounted(async () => {
  const u = await session().catch(() => null);
  if (!u) {
    router.replace('/login');
    return;
  }

  if (u.phoneNo && u.phoneNo.toString().trim()) {
    const redirect = authStore.redirectPath && authStore.redirectPath !== '/' ? authStore.redirectPath : '/';
    authStore.setRedirectPath('/');
    router.replace(redirect);
    return;
  }

  if (u.countryCode && u.countryCode.toString().trim()) {
    countryCode.value = u.countryCode.toString().trim();
  }
});
</script>

<template>
  <div class="min-h-screen grid grid-cols-1 md:grid-cols-2" :class="darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'">
    <div class="flex items-center justify-center px-4 py-10 pb-40">
      <div class="w-full max-w-md relative pt-12">
        <div class="p-6" :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'">
          <h2 class="text-2xl font-black tracking-tight mb-1">
            {{ language === 'en' ? 'Complete your profile' : '補齊個人資料' }}
          </h2>
          <p class="text-sm font-bold opacity-60 mb-6">
            {{ language === 'en' ? 'Please add your phone number to continue.' : '請先填寫電話號碼以繼續。' }}
          </p>

          <form class="space-y-4" @submit.prevent="submitPhone">
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

            <button
              type="submit"
              class="w-full py-3 rounded-xl font-black shadow-sm transition-all active:scale-[0.99]"
              :class="canSubmit ? 'bg-[#007a67] text-white hover:brightness-110' : (darkMode ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')"
              :disabled="!canSubmit"
            >
              {{ loading ? (language === 'en' ? 'Saving...' : '儲存中...') : (language === 'en' ? 'Save and continue' : '儲存並繼續') }}
            </button>

            <p v-if="error" class="text-sm font-bold text-red-500">
              {{ error }}
            </p>
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
