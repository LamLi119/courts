<script setup lang="ts">
import { ref, reactive, watch, onUnmounted } from 'vue';
import { courtApiUrl } from '../../utils/courtApiUrl';

const COURTS_FORM_URL = 'https://join.theground.io/courts-form';
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'info@theground.io';

type CourtsFormField = {
  name: string;
  type: string;
  required: boolean;
  labelKey?: string | null;
  label?: string;
};

const props = defineProps<{
  t: (key: string) => string;
  darkMode: boolean;
}>();

const showForm = ref(false);
const loadingConfig = ref(false);
const submitting = ref(false);
const submitted = ref(false);
const errorMessage = ref('');
const fields = ref<CourtsFormField[]>([]);
const values = reactive<Record<string, string>>({});

function fieldLabel(field: CourtsFormField, t: (key: string) => string) {
  if (field.labelKey) return t(field.labelKey);
  return field.label || field.name;
}

function resetFormState() {
  submitted.value = false;
  errorMessage.value = '';
  for (const key of Object.keys(values)) {
    values[key] = '';
  }
}

async function loadFormConfig() {
  loadingConfig.value = true;
  errorMessage.value = '';
  try {
    const res = await fetch(courtApiUrl('/api/courts-form/config'));
    if (!res.ok) throw new Error(`Failed to load form (${res.status})`);
    const data = await res.json();
    fields.value = Array.isArray(data?.fields) ? data.fields : [];
    for (const field of fields.value) {
      if (!(field.name in values)) values[field.name] = '';
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to load form';
    fields.value = [];
  } finally {
    loadingConfig.value = false;
  }
}

async function openForm() {
  showForm.value = true;
  resetFormState();
  if (!fields.value.length) {
    await loadFormConfig();
  }
}

function closeForm() {
  showForm.value = false;
}

async function submitForm() {
  if (submitting.value) return;
  submitting.value = true;
  errorMessage.value = '';

  try {
    const res = await fetch(courtApiUrl('/api/courts-form/submit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { ...values } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || props.t('landingCtaFormError'));
    }
    submitted.value = true;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : props.t('landingCtaFormError');
  } finally {
    submitting.value = false;
  }
}

watch(showForm, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});

onUnmounted(() => {
  document.body.style.overflow = '';
});
</script>

<template>
  <section class="py-12 md:py-16" :class="darkMode ? 'bg-gray-50 dark:bg-gray-950' : 'bg-gray-50'">
    <div class="container mx-auto px-4 w-full px-4 md:px-6 max-w-7xl mx-auto">
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#007a67] via-[#009e85] to-[#bef264] p-8 md:p-12 lg:p-14">
        <div
          class="absolute -right-8 -bottom-8 w-48 h-48 md:w-64 md:h-64 opacity-10 pointer-events-none select-none"
          aria-hidden="true"
        />

        <div class="relative max-w-xl">
          <h2 class="text-2xl md:text-3xl lg:text-4xl font-black text-white leading-tight">
            {{ t('landingCtaTitle') }}
          </h2>
          <p class="mt-3 text-sm md:text-base text-white/80 leading-relaxed">
            {{ t('landingCtaSubtitle') }}
          </p>
         <!-- <button
            type="button"
            class="hidden mt-6 inline-flex px-6 py-3.5 rounded-xl font-bold text-white bg-[#0f172a] hover:bg-[#1e293b] transition-colors shadow-lg"
            @click="openForm"
          >
            {{ t('landingCtaButton') }}
          </button> -->
          <p class="mt-6 text-sm md:text-base text-white/90">
            {{ t('landingCtaEmailPrompt') }}
            <a
              :href="`mailto:${CONTACT_EMAIL}`"
              class="font-bold text-white underline underline-offset-2 hover:text-white/80 transition-colors"
            >
              {{ CONTACT_EMAIL }}
            </a>
          </p>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-[90] flex items-end md:items-center justify-center p-0 md:p-6"
        @click="closeForm"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        <div
          class="relative w-full md:max-w-xl lg:max-w-2xl max-h-[92vh] md:max-h-[85vh] flex flex-col rounded-t-2xl md:rounded-2xl bg-white shadow-2xl overflow-hidden"
          @click.stop
        >
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
            <h3 class="text-base font-bold text-gray-900">{{ t('landingCtaIframeTitle') }}</h3>
            <button
              type="button"
              class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              :aria-label="t('landingCtaClose')"
              @click="closeForm"
            >
              ×
            </button>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            <div v-if="loadingConfig" class="py-10 text-center text-sm text-gray-500">
              {{ t('landingCtaFormLoading') }}
            </div>

            <div
              v-else-if="submitted"
              class="py-10 text-center"
            >
              <p class="text-lg font-bold text-gray-900">{{ t('landingCtaFormSuccessTitle') }}</p>
              <p class="mt-2 text-sm text-gray-600">{{ t('landingCtaFormSuccessBody') }}</p>
              <button
                type="button"
                class="mt-6 inline-flex px-5 py-2.5 rounded-xl font-semibold text-white bg-[#007a67] hover:bg-[#006a5a] transition-colors"
                @click="closeForm"
              >
                {{ t('landingCtaClose') }}
              </button>
            </div>

            <form
              v-else
              class="space-y-4"
              @submit.prevent="submitForm"
            >
              <p v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {{ errorMessage }}
              </p>

              <div
                v-for="field in fields"
                :key="field.name"
                class="space-y-1.5"
              >
                <label :for="field.name" class="block text-sm font-semibold text-gray-800">
                  {{ fieldLabel(field, props.t) }}
                  <span v-if="field.required" class="text-red-500">*</span>
                </label>
                <textarea
                  v-if="field.type === 'textarea'"
                  :id="field.name"
                  v-model="values[field.name]"
                  :required="field.required"
                  rows="4"
                  class="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#007a67] focus:ring-2 focus:ring-[#007a67]/20"
                />
                <input
                  v-else
                  :id="field.name"
                  v-model="values[field.name]"
                  :type="field.type === 'email' || field.type === 'tel' ? field.type : 'text'"
                  :required="field.required"
                  class="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#007a67] focus:ring-2 focus:ring-[#007a67]/20"
                />
              </div>

              <button
                type="submit"
                class="w-full inline-flex justify-center px-5 py-3 rounded-xl font-bold text-white bg-[#0f172a] hover:bg-[#1e293b] transition-colors disabled:opacity-60"
                :disabled="submitting || !fields.length"
              >
                {{ submitting ? t('landingCtaFormSubmitting') : t('landingCtaFormSubmit') }}
              </button>
            </form>
          </div>

          <p class="shrink-0 px-4 py-2 text-center text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
            {{ t('landingCtaFormFallback') }}
            <a
              :href="COURTS_FORM_URL"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold text-[#007a67] hover:underline"
            >
              {{ t('landingCtaOpenNewTab') }}
            </a>
          </p>
        </div>
      </div>
    </Teleport>
  </section>
</template>
