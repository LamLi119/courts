<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Language } from '../../../types';
import {
  HK_DISTRICTS,
  HK_REGION_LABELS,
  getDistrictDisplayName,
  type HkRegion,
} from '../../utils/hkDistricts';

const props = defineProps<{
  language: Language;
  t: (key: string) => string;
  sports: { id: number; name: string; name_zh?: string | null; slug: string }[];
  selectedDistricts: string[];
  sportSlug: string;
  defaultSportSlug: string;
}>();

const emit = defineEmits<{
  'update:selectedDistricts': [value: string[]];
  'update:sportSlug': [value: string];
  search: [];
}>();

const REGION_ORDER: HkRegion[] = ['hk-island', 'kowloon', 'new-territories'];

const showDistrictSheet = ref(false);
const showSportSheet = ref(false);
const districtSearchQuery = ref('');
const draftDistricts = ref<string[]>([]);

const filteredDistricts = computed(() => {
  const query = districtSearchQuery.value.toLowerCase().trim();
  if (!query) return HK_DISTRICTS;
  return HK_DISTRICTS.filter((district) => {
    const en = district.en.toLowerCase();
    const zh = district.zh;
    return en.includes(query) || zh.includes(query) || district.slug.includes(query);
  });
});

const districtsByRegion = computed(() =>
  REGION_ORDER.map((region) => ({
    region,
    label: props.language === 'zh' ? HK_REGION_LABELS[region].zh : HK_REGION_LABELS[region].en,
    districts: filteredDistricts.value.filter((d) => d.region === region),
  })).filter((group) => group.districts.length > 0)
);

const selectedSportLabel = computed(() => {
  const slug = props.sportSlug || props.defaultSportSlug;
  const sport = props.sports.find((s) => s.slug === slug);
  if (!sport) return props.t('sportType');
  return props.language === 'zh' && sport.name_zh ? sport.name_zh : sport.name;
});

const selectedDistrictLabel = computed(() => {
  const selected = props.selectedDistricts;
  if (selected.length === 0) return props.t('allDistricts');
  if (selected.length === 1) {
    return getDistrictDisplayName(selected[0], props.language);
  }
  return props.language === 'en'
    ? `${selected.length} districts`
    : `${selected.length} 個地區`;
});

const fieldClass =
  'w-full flex items-center justify-between px-4 py-3.5 rounded-[16px] border shadow-sm text-sm font-semibold text-gray-900 bg-white/90 border-gray-100 backdrop-blur transition-colors hover:bg-white active:bg-white';

function openDistrictSheet() {
  showSportSheet.value = false;
  draftDistricts.value = [...props.selectedDistricts];
  showDistrictSheet.value = true;
  districtSearchQuery.value = '';
}

function openSportSheet() {
  showDistrictSheet.value = false;
  showSportSheet.value = true;
}

function closeSheets() {
  showDistrictSheet.value = false;
  showSportSheet.value = false;
  districtSearchQuery.value = '';
}

function toggleDistrict(slug: string) {
  if (draftDistricts.value.includes(slug)) {
    draftDistricts.value = draftDistricts.value.filter((s) => s !== slug);
  } else {
    draftDistricts.value = [...draftDistricts.value, slug];
  }
}

function applyDistrictSelection() {
  emit('update:selectedDistricts', [...draftDistricts.value]);
  closeSheets();
}

function clearDistrictDraft() {
  draftDistricts.value = [];
}

function selectSport(slug: string) {
  emit('update:sportSlug', slug);
  closeSheets();
}

function handleSearch() {
  closeSheets();
  emit('search');
}

watch(
  () => props.sportSlug,
  (slug) => {
    if (!slug && props.defaultSportSlug) {
      emit('update:sportSlug', props.defaultSportSlug);
    }
  },
  { immediate: true }
);
</script>

<template>
  <section class="landing-hero relative overflow-hidden">
    <div class="absolute inset-0 landing-hero-bg" aria-hidden="true" />
    <div class="absolute inset-0 bg-black/20" aria-hidden="true" />

    <div class="relative w-full max-w-7xl mx-auto px-4 py-10 md:py-24 lg:py-28">
      <!-- Mobile: search on top, then headline -->
      <div class="md:hidden w-full max-w-md mx-auto space-y-6">
        <div class="text-center px-1 mb-6">
          <h1 class="text-3xl font-black text-white leading-tight tracking-tight">
            {{ t('landingHeroTitle') }}
          </h1>
          <p class="mt-3 text-base text-gray-100">
            {{ t('landingHeroSubtitle') }}
          </p>
        </div>

        <div class="w-full rounded-2xl bg-white/95 backdrop-blur-md p-4 shadow-2xl space-y-3 border border-white/20">
          <button type="button" :class="fieldClass" :aria-label="language === 'en' ? 'Select district' : '選擇地區'" @click="openDistrictSheet">
            <span class="flex items-center gap-2 truncate min-w-0">
              <span class="text-[#007a67]">📍</span>
              <span class="truncate">{{ selectedDistrictLabel }}</span>
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <button type="button" :class="fieldClass" :aria-label="language === 'en' ? 'Select sport' : '選擇運動'" @click="openSportSheet">
            <span class="flex items-center gap-2 truncate min-w-0">
              <span class="text-[#007a67]">🏸</span>
              <span class="truncate">{{ selectedSportLabel }}</span>
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <button type="button" class="btn btn-cta btn-cta-block w-full py-3.5 rounded-[16px] font-bold" @click="handleSearch">
            {{ t('searchAction') }}
          </button>
        </div>
      </div>

      <!-- Desktop: headline then search (same white card as mobile) -->
      <div class="hidden md:block">
        <div class="max-w-3xl mx-auto text-center mb-8 md:mb-10">
          <h1 class="text-4xl md:text-5xl lg:text-[3.25rem] font-black text-white leading-tight tracking-tight">
            {{ t('landingHeroTitle') }}
          </h1>
          <p class="mt-4 text-base md:text-lg text-gray-100 max-w-2xl mx-auto">
            {{ t('landingHeroSubtitle') }}
          </p>
        </div>

        <div class="max-w-4xl mx-auto">
          <div class="w-full rounded-2xl bg-white/95 backdrop-blur-md p-4 shadow-2xl border border-white/20 flex items-stretch gap-3">
            <button type="button" :class="fieldClass" class="flex-1 min-w-0" :aria-label="language === 'en' ? 'Select district' : '選擇地區'" @click="openDistrictSheet">
              <span class="flex items-center gap-2 truncate min-w-0">
                <span class="text-[#007a67]">📍</span>
                <span class="truncate">{{ selectedDistrictLabel }}</span>
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <button type="button" :class="fieldClass" class="flex-1 min-w-0" :aria-label="language === 'en' ? 'Select sport' : '選擇運動'" @click="openSportSheet">
              <span class="flex items-center gap-2 truncate min-w-0">
                <span class="text-[#007a67]">🏸</span>
                <span class="truncate">{{ selectedSportLabel }}</span>
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <button
              type="button"
              class="btn btn-cta btn-cta-md shrink-0 px-8 py-3.5 rounded-[16px] font-bold inline-flex items-center gap-2"
              @click="handleSearch"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {{ t('searchAction') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Picker overlays -->
    <Teleport to="body">
      <div
        v-if="showDistrictSheet || showSportSheet"
        class="fixed inset-0 z-[80] flex items-end md:items-center md:justify-center p-0 md:p-4"
        @click="closeSheets"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        <div
          v-if="showDistrictSheet"
          class="relative w-full md:max-w-lg max-h-[75vh] md:max-h-[80vh] rounded-t-2xl md:rounded-2xl bg-white shadow-2xl flex flex-col"
          @click.stop
        >
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 class="text-base font-bold text-gray-900">{{ t('district') }}</h3>
            <button type="button" class="w-8 h-8 rounded-full bg-gray-100 text-gray-600" :aria-label="language === 'en' ? 'Close' : '關閉'" @click="closeSheets"><span aria-hidden="true">×</span></button>
          </div>
          <div class="p-4 border-b border-gray-100">
            <input
              v-model="districtSearchQuery"
              type="text"
              :placeholder="language === 'en' ? 'Search districts...' : '搜尋地區...'"
              class="w-full px-4 py-3 rounded-[16px] border border-gray-100 bg-white/90 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#007a67]"
            />
          </div>
          <div class="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <template v-for="group in districtsByRegion" :key="group.region">
              <p class="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {{ group.label }}
              </p>
              <button
                v-for="district in group.districts"
                :key="district.slug"
                type="button"
                class="w-full flex items-center gap-3 px-4 py-3 text-sm rounded-lg hover:bg-gray-50 text-left"
                :class="draftDistricts.includes(district.slug) ? 'bg-[#007a67]/10 text-[#007a67] font-bold' : 'text-gray-800'"
                @click="toggleDistrict(district.slug)"
              >
                <div
                  class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                  :class="draftDistricts.includes(district.slug) ? 'bg-[#007a67] border-[#007a67]' : 'border-gray-300'"
                >
                  <svg
                    v-if="draftDistricts.includes(district.slug)"
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>{{ language === 'zh' ? district.zh : district.en }}</span>
              </button>
            </template>
          </div>
          <div class="p-4 border-t border-gray-100 flex gap-2">
            <button
              type="button"
              class="flex-1 py-3 rounded-[16px] text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              @click="clearDistrictDraft"
            >
              {{ t('clearAll') }}
            </button>
            <button
              type="button"
              class="flex-1 btn btn-cta py-3 rounded-[16px] font-bold"
              @click="applyDistrictSelection"
            >
              {{ t('done') }}
            </button>
          </div>
        </div>

        <div
          v-if="showSportSheet"
          class="relative w-full md:max-w-lg max-h-[60vh] md:max-h-[70vh] rounded-t-2xl md:rounded-2xl bg-white shadow-2xl flex flex-col"
          @click.stop
        >
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 class="text-base font-bold text-gray-900">{{ t('sportType') }}</h3>
            <button type="button" class="w-8 h-8 rounded-full bg-gray-100 text-gray-600" :aria-label="language === 'en' ? 'Close' : '關閉'" @click="closeSheets"><span aria-hidden="true">×</span></button>
          </div>
          <div class="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <button
              v-for="sport in sports"
              :key="sport.id"
              type="button"
              class="w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-gray-50"
              :class="(sportSlug || defaultSportSlug) === sport.slug ? 'bg-[#007a67]/10 text-[#007a67] font-bold' : 'text-gray-800'"
              @click="selectSport(sport.slug)"
            >
              {{ language === 'zh' && sport.name_zh ? sport.name_zh : sport.name }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.landing-hero-bg {
  background-color: #0f172a;
  background-image:
    radial-gradient(ellipse 80% 60% at 20% 40%, rgba(0, 122, 103, 0.5), transparent),
    radial-gradient(ellipse 60% 50% at 80% 20%, rgba(217, 249, 157, 0.18), transparent),
    radial-gradient(ellipse 50% 40% at 60% 80%, rgba(0, 122, 103, 0.35), transparent);
}
</style>
