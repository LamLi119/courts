<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import type { Venue, Language, Sport } from '../../types';

declare const google: any;

const props = withDefaults(
  defineProps<{
    venue: Venue | null;
    sports?: { id: number; name: string; name_zh?: string | null; slug: string }[];
    onSave: (v: any) => Promise<void>;
    onCancel: () => void;
    onDelete?: (id: number) => void;
    language: Language;
    t: (key: string) => string;
    darkMode: boolean;
    isSuperAdmin?: boolean;
  }>(),
  { sports: (): Sport[] => [], isSuperAdmin: false }
);

function parseSocialLinks(s: string | undefined): Record<string, string> {
  const empty = { instagram: '', facebook: '', x: '', threads: '', youtube: '', website: '' };
  if (!s?.trim()) return empty;
  try {
    const p = JSON.parse(s);
    if (p && typeof p === 'object') {
      const strip = (url: unknown, pattern: RegExp) =>
        url && typeof url === 'string' ? url.replace(pattern, '').replace(/\/$/, '') : '';
      return {
        instagram: strip(p.instagram, /^https?:\/\/(www\.)?instagram\.com\/?/i),
        facebook: strip(p.facebook, /^https?:\/\/(www\.)?(fb\.com|facebook\.com)\/?/i),
        x: strip(p.x, /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/?/i),
        threads: strip(p.threads, /^https?:\/\/(www\.)?threads\.net\/@?/i),
        youtube: strip(p.youtube, /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/@?/i),
        website: (p.website && typeof p.website === 'string') ? p.website : ''
      };
    }
  } catch (_) {}
  return { ...empty, website: s || '' };
}

function buildSocialLinkJson(links: Record<string, string>): string {
  const url = (v: string, base: string, prefix = '') =>
    (v && v.trim()) ? (v.trim().startsWith('http') ? v.trim() : `${base}${prefix}${v.trim().replace(/^@?\/?/, '')}`) : '';
  return JSON.stringify({
    instagram: url(links.instagram, 'https://instagram.com/'),
    facebook: url(links.facebook, 'https://facebook.com/'),
    x: url(links.x, 'https://x.com/'),
    threads: url(links.threads, 'https://threads.net/@', '@'),
    youtube: url(links.youtube, 'https://youtube.com/@', '@'),
    website: (links.website && links.website.trim()) ? links.website.trim() : ''
  });
}

const defaultForm = {
  name: '',
  description: '',
  mtrStation: '',
  mtrExit: '',
  walkingDistance: 0,
  address: '',
  ceilingHeight: 0,
  startingPrice: 0,
  pricing: { type: 'text' as const, content: '', imageUrl: '' },
  images: [] as string[],
  amenities: [] as string[],
  whatsapp: '',
  socialLink: '',
  org_icon: '',
  coordinates: { lat: 22.3193, lng: 114.1694 },
  socialLinks: { instagram: '', facebook: '', x: '', threads: '', youtube: '', website: '' },
  sport_data: [] as { sport_id: number; name?: string; slug?: string; sort_order: number }[],
  admin_password: '' as string | null,
  membership_enabled: false,
  membership_description: '' as string | null,
  membership_join_link: '' as string | null,
  court_count: null as number | null
};

const formData = reactive<any>(
  props.venue
    ? { ...defaultForm, ...props.venue, socialLinks: parseSocialLinks(props.venue.socialLink), sport_data: Array.isArray(props.venue.sport_data) ? props.venue.sport_data.map((d: any) => ({ sport_id: Number(d.sport_id), name: d.name, name_zh: d.name_zh ?? null, slug: d.slug, sort_order: Number(d.sort_order) || 0 })) : [], admin_password: (props.venue as any).admin_password ?? '' }
    : { ...defaultForm }
);
if (!formData.sport_data) formData.sport_data = [];
if (formData.admin_password === undefined) formData.admin_password = '';
if (formData.membership_enabled === undefined) formData.membership_enabled = false;
if (formData.membership_description === undefined) formData.membership_description = null;
if (formData.membership_join_link === undefined) formData.membership_join_link = null;
if (formData.court_count === undefined) formData.court_count = null;

const placesApiError = ref(false);
const isUploading = ref(false);
const isSaving = ref(false);
const saveError = ref<string | null>(null);

const fileInputRef = ref<HTMLInputElement | null>(null);
const pricingImageRef = ref<HTMLInputElement | null>(null);
const orgIconInputRef = ref<HTMLInputElement | null>(null);
const addressInputRef = ref<HTMLInputElement | null>(null);
const autocompleteRef = ref<any>(null);
const descriptionEditorRef = ref<HTMLDivElement | null>(null);
const pricingEditorRef = ref<HTMLDivElement | null>(null);
const membershipDescriptionEditorRef = ref<HTMLDivElement | null>(null);
let savedEditorRange: Range | null = null;
let savedPricingRange: Range | null = null;
let savedMembershipDescriptionRange: Range | null = null;
let membershipDescriptionSelectionHandler: (() => void) | null = null;

onMounted(() => {
  nextTick(() => {
    const el = descriptionEditorRef.value;
    if (el) {
      el.innerHTML = formData.description || '';
      const saveRange = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
          savedEditorRange = sel.getRangeAt(0).cloneRange();
        }
      };
      el.addEventListener('mouseup', saveRange);
      el.addEventListener('keyup', saveRange);
      el.addEventListener('blur', saveRange);
      const onSelectionChange = () => {
        if (document.activeElement === el) saveRange();
      };
      document.addEventListener('selectionchange', onSelectionChange);
      (el as any).__selectionChangeHandler = onSelectionChange;
    }

    const pel = pricingEditorRef.value;
    if (pel) {
      pel.innerHTML = formData.pricing?.content || '';
      const savePricingRange = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && pel.contains(sel.anchorNode)) {
          savedPricingRange = sel.getRangeAt(0).cloneRange();
        }
      };
      pel.addEventListener('mouseup', savePricingRange);
      pel.addEventListener('keyup', savePricingRange);
      pel.addEventListener('blur', savePricingRange);
      const onSelectionChangePricing = () => {
        if (document.activeElement === pel) savePricingRange();
      };
      document.addEventListener('selectionchange', onSelectionChangePricing);
      (pel as any).__selectionChangeHandler = onSelectionChangePricing;
    }

    if (formData.membership_enabled) {
      nextTick(() => initMembershipDescriptionEditor());
    }
  });
});

onBeforeUnmount(() => {
  const el = descriptionEditorRef.value;
  if (el && (el as any).__selectionChangeHandler) {
    document.removeEventListener('selectionchange', (el as any).__selectionChangeHandler);
  }
  const pel = pricingEditorRef.value;
  if (pel && (pel as any).__selectionChangeHandler) {
    document.removeEventListener('selectionchange', (pel as any).__selectionChangeHandler);
  }
  if (membershipDescriptionSelectionHandler) {
    document.removeEventListener('selectionchange', membershipDescriptionSelectionHandler);
    membershipDescriptionSelectionHandler = null;
  }
});

function initMembershipDescriptionEditor() {
  const el = membershipDescriptionEditorRef.value;
  if (!el) return;
  el.innerHTML = formData.membership_description || '';
  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      savedMembershipDescriptionRange = sel.getRangeAt(0).cloneRange();
    }
  };
  el.addEventListener('mouseup', saveRange);
  el.addEventListener('keyup', saveRange);
  el.addEventListener('blur', saveRange);
  const onSelectionChange = () => {
    if (document.activeElement === el) saveRange();
  };
  document.addEventListener('selectionchange', onSelectionChange);
  membershipDescriptionSelectionHandler = onSelectionChange;
}

watch(
  () => formData.membership_enabled,
  (enabled) => {
    if (enabled) {
      nextTick(() => initMembershipDescriptionEditor());
    } else {
      if (membershipDescriptionSelectionHandler) {
        document.removeEventListener('selectionchange', membershipDescriptionSelectionHandler);
        membershipDescriptionSelectionHandler = null;
      }
    }
  },
  { immediate: false }
);

function focusEditorAndRestoreSelection() {
  const el = descriptionEditorRef.value;
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  if (savedEditorRange) {
    try {
      sel.removeAllRanges();
      sel.addRange(savedEditorRange);
      return;
    } catch {
      savedEditorRange = null;
    }
  }
  // No saved selection: put caret at end of editor so block/list/link apply there
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // ignore
  }
}

function applyFormat(command: 'bold' | 'italic' | 'underline' | 'strikeThrough', e: MouseEvent) {
  e.preventDefault();
  focusEditorAndRestoreSelection();
  document.execCommand(command, false);
}

function applyBlockFormat(blockTag: 'p' | 'h1' | 'h2' | 'blockquote' | 'pre', e: MouseEvent) {
  e.preventDefault();
  focusEditorAndRestoreSelection();
  document.execCommand('formatBlock', false, blockTag);
}

function insertList(ordered: boolean, e: MouseEvent) {
  e.preventDefault();
  focusEditorAndRestoreSelection();
  document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList', false);
}

function insertLink(e: MouseEvent) {
  e.preventDefault();
  focusEditorAndRestoreSelection();
  const url = prompt('Enter URL:', 'https://');
  if (url != null && url.trim()) document.execCommand('createLink', false, url.trim());
}

function getDescriptionHtml(): string {
  const html = descriptionEditorRef.value?.innerHTML ?? '';
  return html.trim() || '';
}

function focusPricingEditorAndRestoreSelection() {
  const el = pricingEditorRef.value;
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  if (savedPricingRange) {
    try {
      sel.removeAllRanges();
      sel.addRange(savedPricingRange);
      return;
    } catch {
      savedPricingRange = null;
    }
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // ignore
  }
}

function applyPricingFormat(command: 'bold' | 'italic' | 'underline' | 'strikeThrough', e: MouseEvent) {
  e.preventDefault();
  focusPricingEditorAndRestoreSelection();
  document.execCommand(command, false);
}

function applyPricingBlockFormat(blockTag: 'p' | 'h1' | 'h2' | 'blockquote' | 'pre', e: MouseEvent) {
  e.preventDefault();
  focusPricingEditorAndRestoreSelection();
  document.execCommand('formatBlock', false, blockTag);
}

function insertPricingList(ordered: boolean, e: MouseEvent) {
  e.preventDefault();
  focusPricingEditorAndRestoreSelection();
  document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList', false);
}

function insertPricingLink(e: MouseEvent) {
  e.preventDefault();
  focusPricingEditorAndRestoreSelection();
  const url = prompt('Enter URL:', 'https://');
  if (url != null && url.trim()) document.execCommand('createLink', false, url.trim());
}

function getPricingHtml(): string {
  const html = pricingEditorRef.value?.innerHTML ?? '';
  return html.trim() || '';
}

function focusMembershipDescriptionEditorAndRestoreSelection() {
  const el = membershipDescriptionEditorRef.value;
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  if (savedMembershipDescriptionRange) {
    try {
      sel.removeAllRanges();
      sel.addRange(savedMembershipDescriptionRange);
      return;
    } catch {
      savedMembershipDescriptionRange = null;
    }
  }
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // ignore
  }
}

function applyMembershipFormat(command: 'bold' | 'italic' | 'underline' | 'strikeThrough', e: MouseEvent) {
  e.preventDefault();
  focusMembershipDescriptionEditorAndRestoreSelection();
  document.execCommand(command, false);
}

function applyMembershipBlockFormat(blockTag: 'p' | 'h1' | 'h2' | 'blockquote' | 'pre', e: MouseEvent) {
  e.preventDefault();
  focusMembershipDescriptionEditorAndRestoreSelection();
  document.execCommand('formatBlock', false, blockTag);
}

function insertMembershipList(ordered: boolean, e: MouseEvent) {
  e.preventDefault();
  focusMembershipDescriptionEditorAndRestoreSelection();
  document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList', false);
}

function insertMembershipLink(e: MouseEvent) {
  e.preventDefault();
  focusMembershipDescriptionEditorAndRestoreSelection();
  const url = prompt('Enter URL:', 'https://');
  if (url != null && url.trim()) document.execCommand('createLink', false, url.trim());
}

function getMembershipDescriptionHtml(): string {
  const html = membershipDescriptionEditorRef.value?.innerHTML ?? '';
  return html.trim() || '';
}

const toolbarBtnClass =
  'w-9 h-9 rounded-lg border flex items-center justify-center text-sm font-medium transition-colors shrink-0 ';
function toolbarClass(dark: boolean) {
  return dark ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200';
}

// Init Places autocomplete if available
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (!addressInputRef.value) return;

    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn('Places API not available. Autocomplete disabled.');
      placesApiError.value = true;
      return;
    }

    try {
      autocompleteRef.value = new google.maps.places.Autocomplete(addressInputRef.value, {
        componentRestrictions: { country: 'hk' },
        fields: ['geometry', 'formatted_address'],
        types: ['establishment', 'geocode']
      });

      autocompleteRef.value.addListener('place_changed', () => {
        const place = autocompleteRef.value.getPlace();
        if (!place.geometry || !place.geometry.location) return;

        const latLng = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };

        formData.address = place.formatted_address;
        formData.coordinates = latLng;
      });
    } catch (err) {
      console.error('Failed to initialize Autocomplete:', err);
      placesApiError.value = true;
    }
  }, 0);
}

const handleImageUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []) as File[];
  if (files.length === 0) return;

  isUploading.value = true;
  saveError.value = null;

  try {
    const uploadPromises = files.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file as Blob);
        })
    );

    const results = await Promise.all(uploadPromises);
    formData.images = [...formData.images, ...results].slice(0, 12);
  } catch (err) {
    console.error('Upload failed', err);
    saveError.value = 'Failed to upload photos.';
  } finally {
    isUploading.value = false;
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
};

const handlePricingImageUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  isUploading.value = true;
  saveError.value = null;

  try {
    const result = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file as Blob);
    });

    formData.pricing = { ...formData.pricing, imageUrl: result, type: 'image' };
  } catch (err) {
    console.error('Pricing upload failed', err);
    saveError.value = 'Failed to upload pricing image.';
  } finally {
    isUploading.value = false;
    if (pricingImageRef.value) pricingImageRef.value.value = '';
  }
};

const handleOrgIconUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;

  isUploading.value = true;
  saveError.value = null;

  try {
    const result = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file as Blob);
    });
    formData.org_icon = result;
  } catch (err) {
    console.error('Org icon upload failed', err);
    saveError.value = 'Failed to upload org icon.';
  } finally {
    isUploading.value = false;
    if (orgIconInputRef.value) orgIconInputRef.value.value = '';
  }
};

const clearOrgIcon = () => {
  formData.org_icon = null;
};

const addSport = (sport: { id: number; name: string; name_zh?: string | null; slug: string }) => {
  const sid = Number(sport.id);
  if (Number.isNaN(sid) || formData.sport_data.some((d: any) => Number(d.sport_id) === sid)) return;
  formData.sport_data.push({ sport_id: sid, name: sport.name, name_zh: sport.name_zh ?? null, slug: sport.slug, sort_order: formData.sport_data.length });
};
const removeSportBySortedIndex = (sortedIndex: number) => {
  const sorted = sortedSportData();
  const item = sorted[sortedIndex];
  if (!item) return;
  const i = formData.sport_data.findIndex((d: any) => d.sport_id === item.sport_id);
  if (i !== -1) formData.sport_data.splice(i, 1);
  formData.sport_data.forEach((d: any, idx: number) => { d.sort_order = idx; });
};
const moveSportPriority = (sortedIndex: number, delta: number) => {
  const sorted = sortedSportData();
  const ni = sortedIndex + delta;
  if (ni < 0 || ni >= sorted.length) return;
  const a = sorted[sortedIndex];
  const b = sorted[ni];
  const ai = formData.sport_data.findIndex((d: any) => d.sport_id === a.sport_id);
  const bi = formData.sport_data.findIndex((d: any) => d.sport_id === b.sport_id);
  if (ai === -1 || bi === -1) return;
  const so = formData.sport_data[ai].sort_order;
  formData.sport_data[ai].sort_order = formData.sport_data[bi].sort_order;
  formData.sport_data[bi].sort_order = so;
};
const selectedSportIds = () =>
  new Set(
    (formData.sport_data || [])
      .map((d: any) => Number(d.sport_id))
      .filter((n: number) => !Number.isNaN(n))
  );
const sortedSportData = () => (formData.sport_data || []).slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

const sportsOptions = computed(() => (props.sports ?? []) as { id: number; name: string; name_zh?: string | null; slug: string }[]);
const selectedSportIdForDropdown = ref<string | number>('');
function onSelectSportToAdd() {
  const raw = selectedSportIdForDropdown.value;
  if (raw === '') return;
  const id = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (Number.isNaN(id)) return;
  const s = sportsOptions.value.find((x) => x.id === id);
  if (s) {
    addSport({ id: s.id, name: s.name, slug: s.slug });
    selectedSportIdForDropdown.value = '';
  }
}

// Geocode address to get correct lat/lng before save (so map pins are right)
function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) {
      resolve(null);
      return;
    }
    const geocoder = new google.maps.Geocoder();
    const trimmed = (address || '').trim();
    if (!trimmed) {
      resolve(null);
      return;
    }
    geocoder.geocode(
      { address: trimmed, region: 'HK', componentRestrictions: { country: 'HK' } },
      (results: any[] | null, status: string) => {
        if (status !== 'OK' || !results?.[0]?.geometry?.location) {
          resolve(null);
          return;
        }
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      }
    );
  });
}

const handleSubmit = async (e?: Event) => {
  if (e) e.preventDefault();
  if (isUploading.value || isSaving.value) return;
  formData.description = getDescriptionHtml();
  if (formData.pricing?.type === 'text') {
    formData.pricing = {
      ...formData.pricing,
      content: getPricingHtml()
    };
  }
  if (formData.membership_enabled && membershipDescriptionEditorRef.value) {
    formData.membership_description = getMembershipDescriptionHtml() || null;
  }
  isSaving.value = true;
  saveError.value = null;
  try {
    formData.socialLink = buildSocialLinkJson(formData.socialLinks);

    // Always geocode the address on save so we store correct lat/lng for the map
    if (formData.address && (typeof formData.address === 'string' ? formData.address.trim() : '')) {
      const coords = await geocodeAddress(formData.address);
      if (coords) {
        formData.coordinates = coords;
      }
    }

    await props.onSave(formData);
  } catch (err: any) {
    saveError.value = err?.message || 'An unexpected error occurred while saving.';
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = () => {
  if (!props.venue || !props.onDelete) return;
  props.onDelete(props.venue.id);
};

const labelClass =
  'block mb-1 text-[12px] font-[900] uppercase tracking-wider ' +
  (props.darkMode ? 'text-gray-400' : 'text-gray-500');
const inputClass =
  'w-full px-4 py-3 border rounded-[12px] focus:outline-none transition ' +
  (props.darkMode
    ? 'bg-gray-700 border-gray-600 text-white'
    : 'bg-white border-gray-200 text-gray-900');
</script>

<template>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="venue-form-title"
    class="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-0 md:p-4"
  >
    <div
      class="w-full max-w-4xl h-full md:h-[90vh] flex flex-col shadow-2xl md:rounded-[16px] animate-in zoom-in duration-300 overflow-hidden"
      :class="darkMode ? 'bg-gray-800' : 'bg-white'"
    >
      <div class="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-inherit">
        <h2
          id="venue-form-title"
          class="text-[24px] font-[900]"
        >
          Court Management
        </h2>
        <button
          class="text-3xl font-light hover:opacity-50 transition-opacity"
          aria-label="Close form"
          @click="onCancel"
        >
          ×
        </button>
      </div>

      <form
        class="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar"
        @submit.prevent="handleSubmit"
      >
        <div
          v-if="saveError"
          class="animate-in slide-in-from-top-4 duration-300 p-4 bg-red-500 rounded-[12px] flex items-start gap-3 shadow-lg shadow-red-500/20"
        >
          <span class="text-2xl">⚠️</span>
          <div class="flex-1">
            <h4 class="text-white font-[900] text-[12px] uppercase tracking-widest mb-1">
              {{ t('saveFailed') }}
            </h4>
            <p class="text-white text-[12px] font-[700] leading-relaxed">
              {{ saveError }}
            </p>
          </div>
          <button
            class="text-white/60 hover:text-white font-[900] text-xl"
            @click.prevent="saveError = null"
          >
            ×
          </button>
        </div>
        <div v-if="isSuperAdmin" class="rounded-xl p-4 border" :class="darkMode ? 'bg-amber-900/20 border-amber-700/50' : 'bg-amber-50 border-amber-200'">
              <label :class="[labelClass, darkMode ? 'text-amber-300' : 'text-amber-800']">Court Admin Password</label>
              <p class="text-[11px] opacity-80 mb-2" :class="darkMode ? 'text-amber-200/80' : 'text-amber-700'">
                {{ language === 'en' ? 'Set a password so court owners can log in to edit this court. Use the same password on multiple courts to let one admin manage them all.' : '設定密碼讓場地管理員可登入編輯此場地。多個場地設相同密碼即由同一管理員管理。' }}
              </p>
              <input
                v-model="formData.admin_password"
                type="text"
                :class="inputClass"
                :placeholder="venue && formData.admin_password === '' ? (language === 'en' ? 'Input password' : '輸入密碼') : (language === 'en' ? 'Leave blank for no court admin' : '留空表示無專屬管理員')"
              />
            </div>
            <div v-if="isSuperAdmin" class="rounded-xl p-4 border" :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'">
              <label :class="labelClass">{{ language === 'en' ? 'Membership (this court)' : '會員（此場地）' }}</label>
              <p class="text-[11px] opacity-60 mb-2">{{ language === 'en' ? 'Show a membership section on this court\'s page with description and join link.' : '在此場地頁面顯示會員區塊、說明與加入連結。' }}</p>
              <div class="flex items-center gap-3 mb-3">
                <span class="text-sm font-bold">{{ language === 'en' ? 'Enable membership' : '啟用會員' }}</span>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="formData.membership_enabled"
                  class="relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus:outline-none"
                  :class="formData.membership_enabled ? 'bg-[#007a67] border-[#007a67]' : (darkMode ? 'bg-gray-600 border-gray-500' : 'bg-gray-200 border-gray-300')"
                  @click="formData.membership_enabled = !formData.membership_enabled"
                >
                  <span
                    class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition-transform"
                    :class="formData.membership_enabled ? 'translate-x-5' : 'translate-x-0.5'"
                  />
                </button>
              </div>
              <template v-if="formData.membership_enabled">
                <div class="mb-3">
                  <label class="block text-sm font-bold mb-1">{{ language === 'en' ? 'Membership description' : '會員說明' }}</label>
                  <div
                    class="flex flex-wrap gap-1 mb-2 p-2 rounded-t-[12px] border border-b-0"
                    :class="darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'"
                    role="toolbar"
                    aria-label="Format membership description"
                  >
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Bold" @mousedown="applyMembershipFormat('bold', $event)">B</button>
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Italic" class="italic" @mousedown="applyMembershipFormat('italic', $event)">I</button>
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Underline" class="underline" @mousedown="applyMembershipFormat('underline', $event)">U</button>
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Strikethrough" class="line-through" @mousedown="applyMembershipFormat('strikeThrough', $event)">S</button>
                    <span class="w-px h-6 self-center bg-gray-300 dark:bg-gray-600 mx-0.5" aria-hidden="true" />
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Blockquote" @mousedown="applyMembershipBlockFormat('blockquote', $event)">"</button>
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Code block" @mousedown="applyMembershipBlockFormat('pre', $event)">&lt;/&gt;</button>
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Insert link" @mousedown="insertMembershipLink($event)">🔗</button>
                    <span class="w-px h-6 self-center bg-gray-300 dark:bg-gray-600 mx-0.5" aria-hidden="true" />
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Numbered list" @mousedown="insertMembershipList(true, $event)">1.</button>
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Bullet list" @mousedown="insertMembershipList(false, $event)">•</button>
                    <span class="w-px h-6 self-center bg-gray-300 dark:bg-gray-600 mx-0.5" aria-hidden="true" />
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Heading 1" @mousedown="applyMembershipBlockFormat('h1', $event)">H1</button>
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Heading 2" @mousedown="applyMembershipBlockFormat('h2', $event)">H2</button>
                    <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Paragraph" @mousedown="applyMembershipBlockFormat('p', $event)">P</button>
                  </div>
                  <div
                    ref="membershipDescriptionEditorRef"
                    contenteditable="true"
                    class="description-editor min-h-[8rem] px-4 py-3 border rounded-b-[12px] focus:outline-none transition text-left"
                    :class="darkMode ? 'bg-gray-700 border-gray-600 text-white border-t-0' : 'bg-white border-gray-200 text-gray-900 border-t-0'"
                    :data-placeholder="language === 'en' ? 'Describe membership benefits for this court...' : '描述此場地的會員福利...'"
                  />
                </div>
                <div>
                  <label class="block text-sm font-bold mb-1">{{ language === 'en' ? 'Link to join member' : '加入會員連結' }}</label>
                  <input
                    v-model="formData.membership_join_link"
                    type="url"
                    class="w-full rounded-xl border-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007a67]"
                    :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'"
                    placeholder="https://..."
                  />
                </div>
              </template>
            </div>
        <div class="flex flex-col sm:flex-row gap-6 items-start">
          <div class="flex-shrink-0">
            <label :class="labelClass" class="block mb-2">Org Icon (one only)</label>
            <p class="text-[11px] opacity-60 mb-2">Square (1:1) recommended for consistent display.</p>
            <div class="flex flex-wrap items-center gap-3">
              <div
                v-if="formData.org_icon"
                class="relative w-32 h-32 rounded-[12px] overflow-hidden border dark:border-gray-600 flex-shrink-0"
              >
                <img
                  :src="formData.org_icon"
                  class="w-full h-full object-cover"
                  alt="Org icon"
                />
                <button
                  type="button"
                  class="absolute top-0.5 right-0.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                  @click="clearOrgIcon"
                >
                  ×
                </button>
              </div>
              <label
                class="cursor-pointer flex items-center justify-center gap-2 px-4 py-3 rounded-[12px] border-2 border-dashed transition-colors"
                :class="isUploading ? 'border-[#007a67]/30 bg-[#007a67]/5' : 'border-[#007a67]/50 hover:border-[#007a67] hover:bg-[#007a67]/5'"
              >
                <input
                  ref="orgIconInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleOrgIconUpload"
                />
                <span v-if="isUploading" class="text-sm font-bold text-[#007a67]">Uploading…</span>
                <span v-else class="text-sm font-bold text-[#007a67]">{{ formData.org_icon ? 'Change' : 'Upload' }} icon</span>
              </label>
            </div>

          </div>
          <div class="flex-1 min-w-0 flex flex-col gap-4 w-full">
            <div>
              <label :class="labelClass">{{ t('sportTypesPriority') }}</label>
              <p class="text-[11px] opacity-60 mb-2">{{ t('sportTypesHint') }}</p>
              <p v-if="!(sports && sports.length)" class="text-amber-600 dark:text-amber-400 text-sm font-bold mb-2">
                {{ t('noSportTypesHint') }}
              </p>
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <select
                  v-model="selectedSportIdForDropdown"
                  class="rounded-lg border-2 px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#007a67] max-w-[220px]"
                  :class="darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'"
                  :disabled="!(sports && sports.length)"
                  @change="onSelectSportToAdd"
                >
                  <option value="">
                    {{ t('chooseSportToAdd') }}
                  </option>
                  <option
                    v-for="s in sportsOptions"
                    :key="s.id"
                    :value="s.id"
                    :disabled="selectedSportIds().has(s.id)"
                  >
                    {{ language === 'zh' && s.name_zh ? s.name_zh : s.name }}
                    {{ selectedSportIds().has(s.id) ? ' ' + t('sportAdded') : '' }}
                  </option>
                </select>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <div
                  v-for="(d, index) in sortedSportData()"
                  :key="d.sport_id"
                  class="flex items-center gap-1 px-3 py-2 rounded-xl border"
                  :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'"
                >
                  <span class="text-xs font-black text-[#007a67] w-5">{{ Number(index) + 1 }}</span>
                  <span class="font-bold text-sm">{{ (language === 'zh' && d.name_zh) ? d.name_zh : (d.name || d.slug) }}</span>
                  <button type="button" class="p-1 rounded hover:bg-red-500/20 text-red-500" aria-label="Remove" @click.stop="removeSportBySortedIndex(Number(index))">
                    ×
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label :class="labelClass">Court Name *</label>
              <input
                v-model="formData.name"
                type="text"
                :class="inputClass"
                required
              />
            </div>
            <div>
              <label :class="labelClass">Starting Price *</label>
              <input
                v-model.number="formData.startingPrice"
                type="number"
                :class="inputClass"
                required
              />
            </div>
            
            
          </div>
        </div>

        <div class="relative">
          <label :class="labelClass">
            {{ language === 'en' ? 'Full Address *' : '詳細地址 *' }}
          </label>
          <input
            ref="addressInputRef"
            v-model="formData.address"
            type="text"
            :class="inputClass"
            required
            placeholder="Start typing building or street name..."
          />
        </div>
        <div>
          <label :class="labelClass">WhatsApp Number *</label>
          <input
            v-model="formData.whatsapp"
            type="text"
            :class="inputClass"
            required
          />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label :class="labelClass">MTR Station</label>
            <input
              v-model="formData.mtrStation"
              type="text"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">MTR Exit</label>
            <input
              v-model="formData.mtrExit"
              type="text"
              :class="inputClass"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label :class="labelClass">Walking (min)</label>
            <input
              v-model.number="formData.walkingDistance"
              type="number"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">Ceiling (m)</label>
            <input
              v-model.number="formData.ceilingHeight"
              type="number"
              step="0.1"
              :class="inputClass"
            />
          </div>
          <div>
            <label :class="labelClass">{{ language === 'en' ? 'Number of courts' : '場地數量' }}</label>
            <input
              v-model.number="formData.court_count"
              type="number"
              min="0"
              :class="inputClass"
              :placeholder="language === 'en' ? 'Optional' : '選填'"
            />
          </div>
        </div>

        <div>
          <label :class="labelClass">Description</label>
          <div
            class="flex flex-wrap gap-1 mb-2 p-2 rounded-t-[12px] border border-b-0"
            :class="darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'"
            role="toolbar"
            aria-label="Format description"
          >
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Bold" @mousedown="applyFormat('bold', $event)">B</button>
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Italic" class="italic" @mousedown="applyFormat('italic', $event)">I</button>
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Underline" class="underline" @mousedown="applyFormat('underline', $event)">U</button>
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Strikethrough" class="line-through" @mousedown="applyFormat('strikeThrough', $event)">S</button>
            <span class="w-px h-6 self-center bg-gray-300 dark:bg-gray-600 mx-0.5" aria-hidden="true" />
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Blockquote" @mousedown="applyBlockFormat('blockquote', $event)">"</button>
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Code block" @mousedown="applyBlockFormat('pre', $event)">&lt;/&gt;</button>
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Insert link" @mousedown="insertLink($event)">🔗</button>
            <span class="w-px h-6 self-center bg-gray-300 dark:bg-gray-600 mx-0.5" aria-hidden="true" />
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Numbered list" @mousedown="insertList(true, $event)">1.</button>
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Bullet list" @mousedown="insertList(false, $event)">•</button>
            <span class="w-px h-6 self-center bg-gray-300 dark:bg-gray-600 mx-0.5" aria-hidden="true" />
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Heading 1" @mousedown="applyBlockFormat('h1', $event)">H1</button>
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Heading 2" @mousedown="applyBlockFormat('h2', $event)">H2</button>
            <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Paragraph" @mousedown="applyBlockFormat('p', $event)">P</button>
          </div>
          <div
            ref="descriptionEditorRef"
            contenteditable="true"
            class="description-editor min-h-[8rem] px-4 py-3 border rounded-b-[12px] focus:outline-none transition text-left"
            :class="darkMode ? 'bg-gray-700 border-gray-600 text-white border-t-0' : 'bg-white border-gray-200 text-gray-900 border-t-0'"
            data-placeholder="Type something..."
          />
        </div>

        <div>
          <label :class="labelClass" class="block mb-3">Social Links</label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex items-center gap-3">
              <span class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden" :class="darkMode ? 'bg-gray-700' : 'bg-gray-100'" aria-hidden="true">
                <img src="https://static.cdninstagram.com/rsrc.php/v4/yG/r/De-Dwpd5CHc.png" alt="" class="w-9 h-9 object-contain" />
              </span>
              <div class="flex-1 min-w-0 flex items-center rounded-[12px] border overflow-hidden" :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'">
                <span class="pl-3 text-[12px] font-[700] shrink-0" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">instagram.com/</span>
                <input v-model="formData.socialLinks.instagram" type="text" :class="inputClass + ' border-0 rounded-none bg-transparent'" placeholder="username" />
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden" :class="darkMode ? 'bg-gray-700' : 'bg-gray-100'" aria-hidden="true">
                <img src="https://static.xx.fbcdn.net/rsrc.php/yx/r/e9sqr8WnkCf.ico" alt="" class="w-9 h-9 object-contain" />
              </span>
              <div class="flex-1 min-w-0 flex items-center rounded-[12px] border overflow-hidden" :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'">
                <span class="pl-3 text-[12px] font-[700] shrink-0" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">facebook.com/</span>
                <input v-model="formData.socialLinks.facebook" type="text" :class="inputClass + ' border-0 rounded-none bg-transparent'" placeholder="username" />
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden" :class="darkMode ? 'bg-gray-700' : 'bg-gray-100'" aria-hidden="true">
                <img src="https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png" alt="" class="w-9 h-9 object-contain" />
              </span>
              <div class="flex-1 min-w-0 flex items-center rounded-[12px] border overflow-hidden" :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'">
                <span class="pl-3 text-[12px] font-[700] shrink-0" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">x.com/</span>
                <input v-model="formData.socialLinks.x" type="text" :class="inputClass + ' border-0 rounded-none bg-transparent'" placeholder="username" />
              </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden" :class="darkMode ? 'bg-gray-700' : 'bg-gray-100'" aria-hidden="true">
                <img src="https://static.cdninstagram.com/rsrc.php/v4/yV/r/giQBh6jDlMa.png" alt="" class="w-9 h-9 object-contain" />
              </span>
              <div class="flex-1 min-w-0 flex items-center rounded-[12px] border overflow-hidden" :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'">
                <span class="pl-3 text-[12px] font-[700] shrink-0" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">threads.net/@</span>
                <input v-model="formData.socialLinks.threads" type="text" :class="inputClass + ' border-0 rounded-none bg-transparent'" placeholder="username" />
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden" :class="darkMode ? 'bg-gray-700' : 'bg-gray-100'" aria-hidden="true">
                <img src="https://m.youtube.com/static/apple-touch-icon-144x144-precomposed.png" alt="" class="w-9 h-9 object-contain" />
              </span>
              <div class="flex-1 min-w-0 flex items-center rounded-[12px] border overflow-hidden" :class="darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'">
                <span class="pl-3 text-[12px] font-[700] shrink-0" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">youtube.com/@</span>
                <input v-model="formData.socialLinks.youtube" type="text" :class="inputClass + ' border-0 rounded-none bg-transparent'" placeholder="username" />
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden" :class="darkMode ? 'bg-gray-700' : 'bg-gray-100'" aria-hidden="true">
                <img src="https://svgsilh.com/svg/1873373.svg" alt="" class="w-9 h-9 object-contain" :class="darkMode ? 'opacity-90' : ''" />
              </span>
              <div class="flex-1 min-w-0">
                <input v-model="formData.socialLinks.website" type="url" :class="inputClass" placeholder="Your website" />
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <label :class="labelClass">Photos (Max 12)</label>
          <div class="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div
              v-for="(img, i) in formData.images"
              :key="i"
              class="relative aspect-square rounded-[12px] overflow-hidden border dark:border-gray-600"
            >
              <img
                :src="img"
                class="w-full h-full object-cover"
                alt=""
              />
              <button
                type="button"
                class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                @click="formData.images = formData.images.filter((_: string, idx: number) => idx !== i)"
              >
                ×
              </button>
            </div>

            <div
              v-if="isUploading"
              class="aspect-square rounded-[12px] border-2 border-dashed border-[#007a67] flex items-center justify-center bg-[#007a67]/5"
            >
              <div class="w-6 h-6 border-2 border-[#007a67]/20 border-l-[#007a67] rounded-full animate-spin"></div>
            </div>

            <button
              v-if="formData.images.length < 12 && !isUploading"
              type="button"
              class="aspect-square rounded-[12px] border-2 border-dashed flex items-center justify-center text-gray-400 hover:border-[#007a67] hover:text-[#007a67] transition-all bg-gray-50 dark:bg-gray-700/30"
              @click="fileInputRef?.click()"
            >
              <span class="text-2xl">+</span>
            </button>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            multiple
            accept="image/*"
            @change="handleImageUpload"
          />
        </div>

        <div class="space-y-4">
          <label :class="labelClass">Pricing Info (HTML supported)</label>
          <div class="flex p-1 rounded-[8px] text-[10px] font-[900]"
            :class="darkMode ? 'bg-gray-700' : 'bg-gray-100'"
            >
            <button
              type="button"
              class="px-3 py-1 rounded-[6px]"
              :class="formData.pricing.type === 'text' ? (darkMode ? 'bg-gray-600' : 'bg-white') + ' shadow-sm' : 'opacity-40'"
              @click="formData.pricing.type = 'text'"
            >
              TEXT
            </button>
            <button
              type="button"
              class="px-3 py-1 rounded-[6px]"
              :class="formData.pricing.type === 'image' ? (darkMode ? 'bg-gray-600' : 'bg-white') + ' shadow-sm' : 'opacity-40'"
              @click="formData.pricing.type = 'image'"
            >
              IMAGE
            </button>
          </div>
          <div
            v-if="formData.pricing.type === 'text'"
            class="space-y-2"
          >
            <div
              class="flex flex-wrap gap-1 mb-1 p-2 rounded-t-[12px] border border-b-0"
              :class="darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'"
              role="toolbar"
              aria-label="Format pricing"
            >
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Bold" @mousedown="applyPricingFormat('bold', $event)">B</button>
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Italic" class="italic" @mousedown="applyPricingFormat('italic', $event)">I</button>
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Underline" class="underline" @mousedown="applyPricingFormat('underline', $event)">U</button>
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Strikethrough" class="line-through" @mousedown="applyPricingFormat('strikeThrough', $event)">S</button>
              <span class="w-px h-6 self-center bg-gray-300 dark:bg-gray-600 mx-0.5" aria-hidden="true" />
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Blockquote" @mousedown="applyPricingBlockFormat('blockquote', $event)">"</button>
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Code block" @mousedown="applyPricingBlockFormat('pre', $event)">&lt;/&gt;</button>
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Insert link" @mousedown="insertPricingLink($event)">🔗</button>
              <span class="w-px h-6 self-center bg-gray-300 dark:bg-gray-600 mx-0.5" aria-hidden="true" />
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Numbered list" @mousedown="insertPricingList(true, $event)">1.</button>
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Bullet list" @mousedown="insertPricingList(false, $event)">•</button>
              <span class="w-px h-6 self-center bg-gray-300 dark:bg-gray-600 mx-0.5" aria-hidden="true" />
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Heading 1" @mousedown="applyPricingBlockFormat('h1', $event)">H1</button>
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Heading 2" @mousedown="applyPricingBlockFormat('h2', $event)">H2</button>
              <button type="button" :class="toolbarBtnClass + toolbarClass(darkMode)" title="Paragraph" @mousedown="applyPricingBlockFormat('p', $event)">P</button>
            </div>
            <div
              ref="pricingEditorRef"
              contenteditable="true"
              class="description-editor min-h-[6rem] px-4 py-3 border rounded-b-[12px] focus:outline-none transition text-left"
              :class="darkMode ? 'bg-gray-700 border-gray-600 text-white border-t-0' : 'bg-white border-gray-200 text-gray-900 border-t-0'"
              data-placeholder="Type pricing details..."
            />
          </div>
          <div
            v-else
            class="relative h-40 border-2 border-dashed rounded-[12px] flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 overflow-hidden"
          >
            <template v-if="formData.pricing.imageUrl">
              <img
                :src="formData.pricing.imageUrl"
                class="h-full w-full object-contain"
                alt=""
              />
              <button
                type="button"
                class="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full"
                @click="formData.pricing.imageUrl = ''"
              >
                ×
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="text-xs font-bold text-white"
                @click="pricingImageRef?.click()"
              >
                Upload Pricing Image
              </button>
            </template>
            <input
              ref="pricingImageRef"
              type="file"
              class="hidden"
              accept="image/*"
              @change="handlePricingImageUpload"
            />
          </div>
        </div>
      </form>

      <div class="p-6 flex gap-4 md:rounded-b-[16px]"
        :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-t'"
      >
        <button
          type="submit"
          class="flex-1 px-6 py-4 rounded-[8px] font-[900] text-lg shadow-xl active:scale-95 transition-all uppercase flex items-center justify-center gap-3"
          :class="isUploading || isSaving ? (darkMode ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-700 cursor-not-allowed') : 'bg-[#007a67] text-white hover:brightness-105'"
          :disabled="isUploading || isSaving"
          @click="handleSubmit"
        >
          <div
            v-if="isUploading || isSaving"
            class="w-5 h-5 border-3 border-white/20 border-l-white rounded-full animate-spin"
          ></div>
          {{ isSaving ? 'Saving...' : 'Save Court' }}
        </button>
        <button
          v-if="venue && !isSaving && isSuperAdmin"
          type="button"
          class="px-6 py-4 bg-red-500 text-white rounded-[8px] font-[900] active:scale-95 transition-all"
          @click="handleDelete"
        >
          DELETE
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.description-editor:empty::before {
  content: attr(data-placeholder);
  opacity: 0.5;
}
</style>
