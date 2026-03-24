<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

type CountryOption = {
  label: string;
  code: string;
  iso2: string;
};

const props = withDefaults(defineProps<{
  countryCode?: string;
  phoneNumber?: string;
  darkMode?: boolean;
}>(), {
  countryCode: '852',
  phoneNumber: '',
  darkMode: false,
});

const emit = defineEmits<{
  'update:countryCode': [value: string];
  'update:phoneNumber': [value: string];
  'update:is-valid': [value: boolean];
  'validate': [value: boolean];
}>();

const dropdownOpen = ref(false);
const search = ref('');
const localPhone = ref((props.phoneNumber || '').toString());
const localCode = ref((props.countryCode || '852').toString());
const countries = ref<CountryOption[]>([
  { iso2: 'hk', code: '852', label: 'Hong Kong' },
  { iso2: 'mo', code: '853', label: 'Macau' },
  { iso2: 'cn', code: '86', label: 'China' },
  { iso2: 'tw', code: '886', label: 'Taiwan' },
  { iso2: 'sg', code: '65', label: 'Singapore' },
  { iso2: 'jp', code: '81', label: 'Japan' },
  { iso2: 'kr', code: '82', label: 'South Korea' },
  { iso2: 'us', code: '1', label: 'United States' },
  { iso2: 'ca', code: '1', label: 'Canada' },
  { iso2: 'gb', code: '44', label: 'United Kingdom' },
  { iso2: 'fr', code: '33', label: 'France' },
  { iso2: 'de', code: '49', label: 'Germany' },
]);

watch(() => props.countryCode, (v) => {
  if (!v) return;
  localCode.value = String(v);
});

watch(() => props.phoneNumber, (v) => {
  localPhone.value = (v || '').toString();
});

const selectedCountry = computed(() =>
  countries.value.find((c) => c.code === localCode.value) || countries.value[0]
);

const filteredCountries = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return countries.value;
  return countries.value.filter((c) =>
    c.label.toLowerCase().includes(q)
    || c.code.includes(q.replace(/^\+/, ''))
    || c.flag.includes(q)
  );
});

const isPhoneValid = computed(() => /^[0-9]{6,15}$/.test(localPhone.value.trim()));

function onPhoneInput(v: string) {
  const cleaned = v.replace(/[^\d]/g, '');
  localPhone.value = cleaned;
  emit('update:phoneNumber', cleaned);
  emit('update:is-valid', isPhoneValid.value);
}

function flagUrl(iso2: string): string {
  return `https://flagcdn.com/24x18/${(iso2 || '').toLowerCase()}.png`;
}

function pickCountry(code: string) {
  localCode.value = code;
  emit('update:countryCode', code);
  dropdownOpen.value = false;
  search.value = '';
  emit('validate', isPhoneValid.value);
}

function openDropdown() {
  dropdownOpen.value = true;
}

function closeDropdown() {
  dropdownOpen.value = false;
}

function pushCountry(label: string, code: string, cca2: string) {
  if (!code) return;
  const normalized = code.replace(/^\+/, '').trim();
  if (!normalized) return;
  const iso2 = (cca2 || '').toLowerCase();
  if (!/^[a-z]{2}$/.test(iso2)) return;
  const key = `${iso2}-${normalized}`;
  if (seenKeys.value.has(key)) return;
  seenKeys.value.add(key);
  countries.value.push({
    label,
    code: normalized,
    iso2,
  });
}

const seenKeys = ref(new Set<string>());
countries.value.forEach((c) => seenKeys.value.add(`seed-${c.code}-${c.label}`));

onMounted(async () => {
  try {
    const res = await fetch('https://restcountries.com/v3.1/all?fields=name,idd,cca2');
    if (!res.ok) return;
    const data = await res.json();
    for (const item of data || []) {
      const label = item?.name?.common || item?.name?.official || '';
      const root = item?.idd?.root || '';
      const suffixes = Array.isArray(item?.idd?.suffixes) ? item.idd.suffixes : [];
      const cca2 = item?.cca2 || '';
      if (!root || !suffixes.length || !label || !cca2) continue;
      for (const s of suffixes) {
        const dial = `${root}${s}`.replace(/[^\d+]/g, '');
        pushCountry(label, dial, cca2);
      }
    }
    countries.value.sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    // Keep fallback list when fetching full list fails.
  }
});
</script>

<template>
  <div
    class="w-full rounded-xl border flex items-center overflow-visible focus-within:ring-2 focus-within:ring-[#007a67] relative"
    :class="props.darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
  >
    <div class="w-[138px] border-r relative border-inherit">
      <button
        type="button"
        class="w-full px-3 py-3 text-left font-bold bg-transparent outline-none flex items-center justify-between"
        @click="openDropdown"
      >
        <span class="inline-flex items-center gap-2">
          <img :src="flagUrl(selectedCountry.iso2)" alt="" class="w-5 h-[14px] object-cover rounded-sm" />
          <span>{{ `+${selectedCountry.code}` }}</span>
        </span>
        <span class="text-xs opacity-70">▼</span>
      </button>

      <div
        v-if="dropdownOpen"
        class="absolute left-0 top-[calc(100%+6px)] w-[280px] rounded-xl border shadow-xl z-20 p-2"
        :class="props.darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'"
      >
        <input
          v-model="search"
          type="text"
          class="w-full px-3 py-2 rounded-lg border font-bold text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#007a67]"
          :class="props.darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'"
          placeholder="Search country code"
        />
        <div class="max-h-48 overflow-auto space-y-1">
          <button
            v-for="c in filteredCountries"
            :key="`${c.label}-${c.code}`"
            type="button"
            class="w-full text-left px-2 py-2 rounded-md text-sm font-bold"
            :class="props.darkMode ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'"
            @click="pickCountry(c.code)"
          >
            <span class="inline-flex items-center gap-2">
              <img :src="flagUrl(c.iso2)" alt="" class="w-5 h-[14px] object-cover rounded-sm" />
              <span>{{ `${c.label} (+${c.code})` }}</span>
            </span>
          </button>
          <p v-if="filteredCountries.length === 0" class="px-2 py-2 text-xs font-bold opacity-70">
            No result
          </p>
        </div>
      </div>
    </div>

    <input
      :value="localPhone"
      type="tel"
      autocomplete="tel"
      class="flex-1 px-3 py-3 font-bold bg-transparent outline-none"
      placeholder="5123 4567"
      @focus="closeDropdown"
      @input="onPhoneInput(($event.target as HTMLInputElement).value)"
      @blur="emit('validate', isPhoneValid)"
    />

    <button
      v-if="dropdownOpen"
      type="button"
      class="fixed inset-0 z-10"
      aria-label="Close country code list"
      @click="closeDropdown"
    />
  </div>
</template>
