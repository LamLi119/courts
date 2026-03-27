<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { Venue, Language } from '../../types';
import { getStationDisplayName } from '../utils/mtrStations';
import { applyVenueSeo, resetSeoToDefault, getSportTypeLabel, getVenueImageAlt } from '../utils/seo';
import ImageCarousel from './ImageCarousel.vue';
import { useAuth } from '../composables/auth';

const ALLOWED_TAGS = new Set([
  'b', 'i', 'u', 's', 'strong', 'em', 'br', 'p', 'span', 'div',
  'blockquote', 'pre', 'code', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3'
]);
const VOID_TAGS = new Set(['br']);
const ALLOWED_ATTR = new Set(['href', 'target', 'rel']);

function decodeHtmlEntities(str: string): string {
  if (typeof document === 'undefined') return str;
  const el = document.createElement('textarea');
  el.innerHTML = str;
  return el.value;
}

function escapeAttr(val: string): string {
  return val.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sanitizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return Array.from(el.childNodes).map(sanitizeNode).join('');
  let out = '<' + tag;
  for (const attr of el.attributes) {
    if (ALLOWED_ATTR.has(attr.name.toLowerCase())) out += ' ' + attr.name + '="' + escapeAttr(attr.value) + '"';
  }
  out += '>';
  if (!VOID_TAGS.has(tag)) {
    for (const child of el.childNodes) out += sanitizeNode(child);
    out += '</' + tag + '>';
  }
  return out;
}

function sanitizeDescription(html: string | undefined): string {
  if (!html?.trim()) return '';
  const decoded = decodeHtmlEntities(html);
  if (typeof DOMParser === 'undefined') return decoded;
  const doc = new DOMParser().parseFromString('<div>' + decoded + '</div>', 'text/html');
  const div = doc.body.firstElementChild;
  return div ? Array.from(div.childNodes).map(sanitizeNode).join('') : '';
}

const props = defineProps<{
  venue: Venue;
  onBack: () => void;
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  savedVenues: number[];
  toggleSave: (id: number) => void;
  isAdmin: boolean;
  /** When true, show Edit button (e.g. super admin or court admin for this venue). */
  canEdit?: boolean;
  onEdit: () => void;
}>();

const { user } = useAuth();
const canSeeSpecialOffer = computed(() => props.isAdmin || !!user.value);

const goToLogin = () => {
  if (typeof window !== 'undefined') {
    try {
      const path = window.location.pathname + window.location.search + window.location.hash;
      window.sessionStorage?.setItem('auth_redirect_path', path);
    } catch (_) {
      // ignore
    }
  }
  // Route is not available in this component; use location for simplicity.
  if (typeof window !== 'undefined') window.location.href = '/login';
};

const allDetailImages = computed(() => [...(props.venue.images || [])]);

const fullscreenImages = ref<string[]>([]);
const fullscreenIndex = ref(0);
const showFullscreen = computed(() => fullscreenImages.value.length > 0);
const currentFullscreenSrc = computed(
  () => fullscreenImages.value[fullscreenIndex.value] ?? null
);

const openFullscreen = (src: string) => {
  const list = allDetailImages.value;
  const idx = list.indexOf(src);
  if (idx >= 0) {
    fullscreenImages.value = list;
    fullscreenIndex.value = idx;
  } else {
    fullscreenImages.value = [src];
    fullscreenIndex.value = 0;
  }
};

const closeFullscreen = () => {
  fullscreenImages.value = [];
};

const fullscreenPrev = () => {
  const n = fullscreenImages.value.length;
  if (n <= 1) return;
  fullscreenIndex.value = fullscreenIndex.value === 0 ? n - 1 : fullscreenIndex.value - 1;
};

const fullscreenNext = () => {
  const n = fullscreenImages.value.length;
  if (n <= 1) return;
  fullscreenIndex.value = fullscreenIndex.value === n - 1 ? 0 : fullscreenIndex.value + 1;
};

const isSaved = () => props.savedVenues.includes(props.venue.id);

const handleWhatsApp = () => {
  const message = encodeURIComponent(
    `你好，我係經TheGround.io嘅介紹嚟book場！Hi! Here to book a court, found you via TheGround.io`
  );
  window.open(
    `https://wa.me/${props.venue.whatsapp.replace(/[^0-9]/g, '')}?text=${message}`,
    '_blank'
  );
};

const openGoogleMaps = () => {
  const encodedAddress = encodeURIComponent(props.venue.address);
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
};

const shareFeedback = ref<string | null>(null);
const handleShare = async () => {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const title = props.venue.name;
  try {
    if (navigator.share) {
      await navigator.share({ title, url, text: title });
    } else {
      await navigator.clipboard.writeText(url);
      shareFeedback.value = props.t('linkCopied');
      setTimeout(() => { shareFeedback.value = null; }, 2000);
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      try {
        await navigator.clipboard.writeText(url);
        shareFeedback.value = props.t('linkCopied');
        setTimeout(() => { shareFeedback.value = null; }, 2000);
      } catch (_) {
        shareFeedback.value = props.language === 'en' ? 'Could not share' : '無法分享';
        setTimeout(() => { shareFeedback.value = null; }, 2000);
      }
    }
  }
};

const openJoinMembership = () => {
  if (props.venue.membership_join_link) {
    window.open(props.venue.membership_join_link, '_blank');
  } else {
    handleWhatsApp();
  }
};

const SOCIAL_ICON_CDN = 'https://cdn.simpleicons.org';

function parseSocialLinks(s: string | undefined): { name: string; url: string; icon: string }[] {
  if (!s?.trim()) return [];
  try {
    const p = JSON.parse(s);
    if (p && typeof p === 'object') {
      const entries = [
        { key: 'instagram', url: p.instagram, label: 'Instagram' },
        { key: 'facebook', url: p.facebook, label: 'Facebook' },
        { key: 'x', url: p.x, label: 'X' },
        { key: 'threads', url: p.threads, label: 'Threads' },
        { key: 'youtube', url: p.youtube, label: 'YouTube' },
        { key: 'website', url: p.website, label: 'Website' }
      ];
      return entries
        .filter((e) => e.url && typeof e.url === 'string')
        .map((e) => ({ name: e.label, url: e.url, icon: e.key === 'website' ? 'link' : e.key }));
    }
  } catch (_) { }
  return s.startsWith('http') ? [{ name: 'View on social', url: s, icon: 'link' }] : [];
}

const socialLinksList = () => parseSocialLinks(props.venue.socialLink);

const openSocialLink = (url: string) => {
  if (url) window.open(url, '_blank');
};

const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

onMounted(() => {
  applyVenueSeo(props.venue, baseUrl, props.language);
});
watch(() => props.venue, (v) => {
  if (v) applyVenueSeo(v, baseUrl, props.language);
}, { immediate: true });
onUnmounted(() => {
  resetSeoToDefault();
});

const venueImageAlt = computed(() => getVenueImageAlt(props.venue, props.language));

/** Description + pricing share one panel with tabs when both exist. */
const hasDescriptionText = computed(() => !!props.venue.description?.trim());

const hasPricingDetail = computed(() => {
  const p = props.venue.pricing;
  if (!p) return false;
  if (p.type === 'text' && p.content?.trim()) return true;
  return !!p.imageUrl?.trim();
});

const showDetailTabs = computed(() => hasDescriptionText.value && hasPricingDetail.value);

const detailTab = ref<'description' | 'pricing'>('description');

watch(
  () => [props.venue.id, hasDescriptionText.value, hasPricingDetail.value] as const,
  () => {
    if (hasDescriptionText.value) detailTab.value = 'description';
    else if (hasPricingDetail.value) detailTab.value = 'pricing';
  },
  { immediate: true }
);
</script>

<template>
  <div class="min-h-screen pb-24 md:pb-20 animate-in fade-in duration-300"
    :class="darkMode ? 'bg-gray-900' : 'bg-white'">
    <!-- Fullscreen image lightbox with carousel -->
    <Teleport to="body">
      <div v-if="showFullscreen" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
        role="dialog" aria-modal="true" aria-label="View full image" @click.self="closeFullscreen">
        <button type="button" class="btn btn-overlay absolute top-4 right-4 z-10 w-10 h-10 text-2xl leading-none"
          aria-label="Close" @click="closeFullscreen">
          ×
        </button>
        <template v-if="fullscreenImages.length > 1">
          <button type="button"
            class="btn btn-overlay-solid absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 text-xl"
            aria-label="Previous" @click.stop="fullscreenPrev">
            ←
          </button>
          <button type="button"
            class="btn btn-overlay-solid absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 text-xl"
            aria-label="Next" @click.stop="fullscreenNext">
            →
          </button>
          <div
            class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-1.5 bg-black/40 rounded-full text-white text-sm font-bold">
            {{ fullscreenIndex + 1 }} / {{ fullscreenImages.length }}
          </div>
        </template>
        <img v-if="currentFullscreenSrc" :src="currentFullscreenSrc" class="max-w-full max-h-full object-contain"
          alt="Full size" @click.stop />
      </div>
    </Teleport>
    <div class="sticky top-0 z-[70] px-4 py-3 flex items-center justify-between border-b backdrop-blur-md"
      :class="darkMode ? 'bg-gray-900/90 border-gray-800 text-white' : 'bg-white/90 border-gray-100 text-gray-900'">
      <button type="button" class="btn btn-nav-icon btn-utility-round" @click="onBack">
        ←
      </button>
      <h1 class="text-lg font-[900] truncate max-w-[200px] md:max-w-md flex items-center gap-2">
        <img v-if="venue.org_icon" :src="venue.org_icon"
          class="w-8 h-8 rounded-lg flex-shrink-0 object-cover border border-gray-200" :alt="venueImageAlt"
          fetchpriority="high" />
        <span class="truncate">{{ venue.name }}</span>
      </h1>
      <div class="flex items-center gap-2">
        <button type="button" id="share-button" class="btn btn-utility btn-utility-round" aria-label="Share"
          :class="darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'"
          @click="handleShare">
          <svg id="share-icon" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
        <span v-if="shareFeedback" class="text-xs font-bold text-[#007a67] animate-in fade-in duration-200">{{
          shareFeedback
        }}</span>
        <button v-if="(canEdit !== undefined ? canEdit : isAdmin)" type="button"
          class="btn btn-utility btn-utility-round bg-blue-500 text-white hover:bg-blue-600" @click="onEdit">
          ✏️
        </button>
        <button type="button" class="btn btn-utility btn-utility-round"
          :class="isSaved() ? 'bg-red-500 text-white hover:bg-red-600' : ''" @click="toggleSave(venue.id)">
          {{ isSaved() ? '❤️' : '🤍' }}
        </button>
      </div>
    </div>

    <div class="container mx-auto px-4 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-8">
          <ImageCarousel :images="venue.images" :venue-name="venue.name"
            :sport-type="getSportTypeLabel(venue, language)" :on-image-click="openFullscreen" />
          <div class="space-y-6">
            <h2 class="text-[24px] md:text-[32px] font-[900] tracking-tight flex items-center gap-3"
              :class="darkMode ? 'text-white' : 'text-gray-900'">
              <img v-if="venue.org_icon" :src="venue.org_icon"
                class="w-12 h-12 md:w-14 md:h-14 rounded-xl flex-shrink-0 object-cover border border-gray-200"
                :alt="venueImageAlt" fetchpriority="high" />
              <span>{{ venue.name }}</span>
            </h2>
            <template v-if="socialLinksList().length > 0">
            </template>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] font-[400]"
              :class="darkMode ? 'text-gray-400' : 'text-gray-600'">
              <span v-if="venue.mtrStation" class="rounded-md px-2.5 py-0.5 text-xs font-medium shrink-0"
                :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'">🚇 {{
                  getStationDisplayName(venue.mtrStation, language) }} ({{ venue.mtrExit }})</span>
              <span v-if="venue.walkingDistance > 0" class="rounded-md px-2.5 py-0.5 text-xs font-medium shrink-0"
                :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'">
                {{ venue.walkingDistance }} {{ t('min') }} {{ t('walk') }}
              </span>
              <span v-if="venue.ceilingHeight > 0" class="rounded-md px-2.5 py-0.5 text-xs font-medium shrink-0"
                :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'">
                {{ venue.ceilingHeight }}m {{ t('ceilingHeight') }}
              </span>
              <span v-if="venue.court_count != null && venue.court_count > 0"
                class="rounded-md px-2.5 py-0.5 text-xs font-medium shrink-0"
                :class="darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'">
                🥅 {{ venue.court_count }} {{ venue.court_count === 1 ? t('court') : t('courts') }}
              </span>
            </div>
            <div v-if="hasDescriptionText || hasPricingDetail"
              class="rounded-[12px] border overflow-hidden"
              :class="darkMode ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-gray-50/80'">
              <div v-if="showDetailTabs" class="flex border-b"
                :class="darkMode ? 'border-gray-700' : 'border-gray-200'" role="tablist"
                :aria-label="language === 'en' ? 'Venue details' : '場地資訊'">
                <button type="button" role="tab" :aria-selected="detailTab === 'description'"
                  class="flex-1 py-3 px-3 text-[12px] md:text-[13px] font-bold uppercase tracking-wider transition-colors"
                  :class="detailTab === 'description'
                    ? (darkMode ? 'bg-gray-800 text-white shadow-[inset_0_-2px_0_0_#007a67]' : 'bg-white text-gray-900 shadow-[inset_0_-2px_0_0_#007a67]')
                    : (darkMode ? 'text-gray-400 hover:bg-gray-800/80' : 'text-gray-500 hover:bg-gray-100')"
                  @click="detailTab = 'description'">
                  {{ t('description') }}
                </button>
                <button type="button" role="tab" :aria-selected="detailTab === 'pricing'"
                  class="flex-1 py-3 px-3 text-[12px] md:text-[13px] font-bold uppercase tracking-wider transition-colors"
                  :class="detailTab === 'pricing'
                    ? (darkMode ? 'bg-gray-800 text-white shadow-[inset_0_-2px_0_0_#007a67]' : 'bg-white text-gray-900 shadow-[inset_0_-2px_0_0_#007a67]')
                    : (darkMode ? 'text-gray-400 hover:bg-gray-800/80' : 'text-gray-500 hover:bg-gray-100')"
                  @click="detailTab = 'pricing'">
                  {{ t('pricing') }}
                </button>
              </div>
              <div v-else class="px-4 pt-3 pb-1 border-b"
                :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
                <h3 class="text-[11px] uppercase tracking-widest font-bold opacity-70 m-0">
                  {{ hasDescriptionText ? t('description') : t('pricing') }}
                </h3>
              </div>
              <div class="p-4">
                <div v-show="hasDescriptionText && (!showDetailTabs || detailTab === 'description')"
                  class="text-[14px] font-[400] leading-relaxed description-html pr-2 pl-2"
                  :class="darkMode ? 'text-gray-300' : 'text-gray-600'"
                  v-html="sanitizeDescription(venue.description)" />
                <div v-show="hasPricingDetail && (!showDetailTabs || detailTab === 'pricing')" class="space-y-2">
                  <div v-if="venue.pricing.type === 'text' && venue.pricing.content"
                    class="text-[14px] description-html pr-2 pl-2 rounded-[8px]"
                    :class="darkMode ? 'text-gray-300' : 'text-gray-700'"
                    v-html="sanitizeDescription(venue.pricing.content)" />
                  <button v-else-if="venue.pricing.imageUrl" type="button"
                    class="w-full rounded-[12px] overflow-hidden border cursor-pointer block text-left"
                    :class="darkMode ? 'border-gray-600' : 'border-gray-200'"
                    @click="openFullscreen(venue.pricing.imageUrl!)">
                    <img :src="venue.pricing.imageUrl" class="w-full" alt="Pricing" />
                  </button>
                </div>
              </div>
            </div>
            <!-- Mobile view -->
            <div class="lg:hidden space-y-4 mt-4">
              <!-- Mobile: Contact button -->
              <div class="flex justify-end">
                <button type="button" id="contact-button" class="btn btn-ghost shrink-0" @click="handleWhatsApp">
                  <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path
                      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  {{ t('contact') }}
                </button>
              </div>
              <!-- Mobile: Location -->
              <div v-if="venue.address && venue.address.trim() !== ''" class="lg:hidden pt-4 mt-2 mb-4 border-t border-gray-300">
                <div class="flex justify-between w-full">
                  <h3 class="uppercase tracking-widest font-bold opacity-90"
                  :class="language === 'en' ? 'text-[12px]' : 'text-[14px]'">
                    {{ t('location') }}
                  </h3>

                  <button type="button" id="google-maps-button" class="btn btn-text btn-sm w-1/2" @click="openGoogleMaps">
                    📍 {{ t('openInGoogleMaps') }}
                  </button>

                </div>
                <div class="p-4 rounded-[16px] border w-full"
                  :class="darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-700'">
                  <p class="text-[14px] leading-relaxed" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                    {{ venue.address }}
                  </p>

                </div>
              </div>
              <div v-if="venue.membership_enabled && (venue.membership_description || venue.membership_join_link)" class="flex justify-between w-full pt-4 mt-2 mb-4 border-t border-gray-300">
                <h3 class="uppercase tracking-widest font-bold opacity-90"
                :class="language === 'en' ? 'text-[12px]' : 'text-[14px]'">
                  {{ language === 'en' ? 'Special offer' : '特別優惠' }}
                </h3>
                <button v-if="venue.membership_join_link && canSeeSpecialOffer" type="button" id="special-offer-button" class="text-[12px] font-[700] text-[#007a67] uppercase w-1/2 text-right hover:underline"
                  @click="openJoinMembership">
                  {{ language === 'en' ? 'Get the offer' : '獲取優惠' }} →
                </button>
              </div>
              <div v-if="venue.membership_enabled && (venue.membership_description || venue.membership_join_link)"
                class="p-4 rounded-[16px] border w-full relative overflow-hidden"
                :class="darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-700'">
                <div v-if="venue.membership_description" class="text-[14px] font-[400] leading-relaxed description-html"
                  :class="darkMode ? 'text-gray-200' : 'text-gray-800'"
                  :style="!canSeeSpecialOffer ? 'filter: blur(6px); user-select: none; pointer-events: none;' : ''"
                  v-html="sanitizeDescription(venue.membership_description)"></div>
                <div v-if="!canSeeSpecialOffer" class="absolute inset-0 flex items-center justify-center">
                  <button
                    type="button"
                    id="login-to-view-button"
                    class="px-4 py-2 rounded-xl font-black shadow-xl bg-[#007a67] text-white hover:brightness-110"
                    @click="goToLogin"
                  >
                    {{ language === 'en' ? 'Login to view' : '登入以查看' }}
                  </button>
                </div>
              </div>
            </div>
            <!-- Desktop: social links at left bottom with full URL -->
            <template v-if="socialLinksList().length > 0">
              <div class="hidden lg:block space-y-3 pt-6 border-t"
                :class="darkMode ? 'border-gray-700' : 'border-gray-200'">
                <h3 class="uppercase tracking-widest font-bold opacity-90"
                :class="language === 'en' ? 'text-[14px]' : 'text-[16px]'">
                  {{ language === 'en' ? 'Social links' : '社群連結' }}
                </h3>
                <div class="space-y-2">
                  <a v-for="link in socialLinksList()" :key="link.url" :href="link.url" target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-start gap-3 p-3 rounded-[8px] border text-left break-all text-[13px] hover:opacity-80 transition-opacity"
                    :class="darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700/50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'">
                    <span class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden"
                      :class="darkMode ? 'bg-gray-700' : 'bg-gray-100'" aria-hidden="true">
                      <img :src="`${SOCIAL_ICON_CDN}/${link.icon}`" :alt="link.name" class="w-5 h-5 object-contain"
                        loading="lazy" />
                    </span>
                    <div class="min-w-0 flex-1">
                      <span class="font-bold block mb-1">{{ link.name }}</span>
                      <span class="opacity-80 text-[12px]">{{ link.url }}</span>
                    </div>
                  </a>
                </div>
              </div>
            </template>
            <!-- Mobile: social links – leave extra space above fixed bar -->
            <div class="lg:hidden space-y-6 pt-4 pb-24 border-t border-gray-300">
              <template v-if="socialLinksList().length > 0">
                <div class="space-y-2">
                  <h3 class="uppercase tracking-widest font-bold opacity-90"
                  :class="language === 'en' ? 'text-[12px]' : 'text-[14px]'">
                    {{ language === 'en' ? 'Social links' : '社群連結' }}
                  </h3>
                  <div class="space-y-2">
                    <a v-for="link in socialLinksList()" :key="link.url" :href="link.url" target="_blank"
                      rel="noopener noreferrer"
                      class="flex items-start gap-3 p-3 rounded-[8px] border text-left break-all text-[13px] hover:opacity-80 transition-opacity"
                      :class="darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700/50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'">
                      <span class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden"
                        :class="darkMode ? 'bg-gray-700' : 'bg-gray-100'" aria-hidden="true">
                        <img :src="`${SOCIAL_ICON_CDN}/${link.icon}`" :alt="link.name" class="w-5 h-5 object-contain"
                          loading="lazy" />
                      </span>
                      <div class="min-w-0 flex-1">
                        <span class="font-bold block mb-1">{{ link.name }}</span>
                        <span class="opacity-80 text-[12px]">{{ link.url }}</span>
                      </div>
                    </a>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Desktop: right sidebar -->
        <div class="hidden lg:block lg:col-span-1">
          <div v-if="venue.address && venue.address.trim() !== ''" class="sticky top-24 space-y-6 p-8 rounded-[16px] shadow-2xl border"
            :class="darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'">
            <div class="flex items-center justify-between gap-4 max-w-lg mx-auto mb-4">
              <span class="uppercase tracking-widest font-bold opacity-90 whitespace-nowrap"
              :class="language === 'en' ? 'text-[14px]' : 'text-[16px]'">
                {{ language === 'en' ? 'Price' : '價格' }}
              </span>
              <div class="flex items-baseline gap-1 min-w-0">
                <span class="text-[11px] font-[700] opacity-60 uppercase"
                  :class="language === 'en' ? 'block' : 'hidden'">
                  {{ language === 'en' ? 'Up to' : '' }}
                </span>
                <span class="text-[22px] font-[900] text-[#007a67]">${{ venue.startingPrice }}</span>
                <span class="text-[11px] font-[700] opacity-60 uppercase"
                  :class="language === 'en' ? 'hidden' : 'block'">
                  {{ language === 'en' ? '' : '起' }}
                </span>
                <span class="text-[14px] opacity-60">/{{ language === 'en' ? 'hr' : '小時' }}</span>
              </div>
            </div>
            <button type="button" id="contact-button" class="btn btn-ghost btn-cta-block btn-cta-md w-full" @click="handleWhatsApp">
              <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              {{ t('contact') }}
            </button>
            <!-- Desktop: location -->
            <div class="space-y-4">
              <div v-if="venue.address && venue.address.trim() !== ''" class="flex justify-between w-full">
                <h3 class="uppercase tracking-widest font-bold opacity-90"
                :class="language === 'en' ? 'text-[14px]' : 'text-[16px]'">
                  {{ t('location') }}
                </h3>

                <button type="button" class="text-[12px] font-[700] text-[#007a67] uppercase w-1/2 text-right hover:font-bold hover:underline" @click="openGoogleMaps">
                  📍 {{ t('openInGoogleMaps') }}
                </button>

              </div>
              <div class="p-4 rounded-[16px] border w-full"
                :class="darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-700'">
                <p class="text-[14px] leading-relaxed" :class="darkMode ? 'text-gray-300' : 'text-gray-700'">
                  {{ venue.address }}
                </p>

              </div>
            </div>
            <!-- Desktop: membership -->
            <div v-if="venue.membership_enabled && (venue.membership_description || venue.membership_join_link)"
              class="space-y-4">
              <h3 class="uppercase tracking-widest font-bold opacity-90"
                :class="language === 'en' ? 'text-[14px]' : 'text-[16px]'">
                {{ language === 'en' ? 'Special offer' : '特別優惠' }}
              </h3>
              <div class="p-4 rounded-[16px] border w-full relative overflow-hidden"
                :class="darkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-700'">
                <div v-if="venue.membership_description" class="text-[14px] font-[400] leading-relaxed description-html"
                  :class="darkMode ? 'text-gray-200' : 'text-gray-800'"
                  :style="!canSeeSpecialOffer ? 'filter: blur(6px); user-select: none; pointer-events: none;' : ''"
                  v-html="sanitizeDescription(venue.membership_description)" />
                <div v-if="!canSeeSpecialOffer" class="absolute inset-0 flex items-center justify-center">
                  <button
                    type="button"
                    id="login-to-view-button"
                    class="px-4 py-2 rounded-xl font-black shadow-xl bg-[#007a67] text-white hover:brightness-110"
                    @click="goToLogin"
                  >
                    {{ language === 'en' ? 'Login to view' : '登入以查看' }}
                  </button>
                </div>
              </div>
            </div>

            <button v-if="canSeeSpecialOffer && venue.membership_enabled && venue.membership_join_link"
              type="button"
              id="special-offer-button"
              class="flex-shrink-0 w-full py-4 rounded-[12px] text-white font-[900] text-lg bg-[#007a67]"
              @click="openSocialLink(venue.membership_join_link)">
              {{ t('joinMembership') }}
            </button>

          </div>
        </div>
      </div>
    </div>

    <!-- Mobile: fixed bar – price + Join membership -->
    <div v-if="venue.startingPrice > 0" class="fixed bottom-0 left-0 right-0 z-50 p-4 border-t lg:hidden"
      :class="darkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-gray-200'">
      <div class="flex items-center justify-between gap-4 max-w-lg mx-auto">
        <div class="flex items-baseline gap-1 min-w-0">
          <span class="text-[12px] font-[700] opacity-60 uppercase" :class="language === 'en' ? 'block' : 'hidden'">
            {{ language === 'en' ? 'Up to' : '' }}
          </span>
          <span class="text-[22px] font-[900] text-[#007a67]">${{ venue.startingPrice }}</span>
          <span class="text-[12px] font-[700] opacity-60 uppercase" :class="language === 'en' ? 'hidden' : 'block'">
            {{ language === 'en' ? '' : '起' }}
          </span>
          <span class="text-[14px] opacity-60">/{{ t('hour') }}</span>
        </div>
        <button v-if="canSeeSpecialOffer && venue.membership_enabled && venue.membership_join_link"
         type="button"
         id="special-offer-button-mobile"
          class="btn btn-cta flex-shrink-0 max-w-[200px] py-3 px-4" @click="openSocialLink(venue.membership_join_link)">
          {{ t('joinMembership') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.description-html :deep(h1) {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0.75em 0 0.25em;
}

.description-html :deep(h2) {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0.5em 0 0.25em;
}

.description-html :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0.5em 0 0.25em;
}

.description-html :deep(blockquote) {
  border-left: 4px solid currentColor;
  padding-left: 1rem;
  margin: 0.5em 0;
  opacity: 0.9;
}

.description-html :deep(pre),
.description-html :deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
  background: rgba(0, 0, 0, 0.06);
  padding: 0.15em 0.4em;
  border-radius: 4px;
}

.description-html :deep(pre) {
  display: block;
  padding: 0.75rem;
  overflow-x: auto;
}

.description-html :deep(div) {
  display: block;
  margin: 0.35em 0;
}

.description-html :deep(ul) {
  list-style: disc;
  padding-left: 1.5rem;
  margin: 0.5em 0;
}

.description-html :deep(ol) {
  list-style: decimal;
  padding-left: 1.5rem;
  margin: 0.5em 0;
}

.description-html :deep(li) {
  margin: 0.25em 0;
}

.description-html :deep(a) {
  color: #007a67;
  text-decoration: underline;
}

.description-html :deep(a:hover) {
  opacity: 0.85;
}
</style>
