<script setup lang="ts">
import { ref, computed } from 'vue';
import { venueCardImageSrc } from '../../utils/venueImageUrl';

const props = withDefaults(
  defineProps<{
    images: string[];
    onImageClick?: (src: string) => void;
    venueName?: string;
    sportType?: string;
  }>(),
  { venueName: '', sportType: 'Court' }
);

const index = ref(0);

const imageAlt = computed(() =>
  props.venueName && props.sportType
    ? `${props.venueName} ${props.sportType} area`
    : 'Court photo'
);

/** Serve detail carousel via resized proxy (not multi‑MB GCS originals). */
const displayImages = computed(() =>
  (props.images || []).map((src) => venueCardImageSrc(src, true, 960)),
);
</script>

<template>
  <div
    v-if="!displayImages || displayImages.length === 0"
    class="w-full aspect-[16/9] bg-gray-200 rounded-2xl flex items-center justify-center text-gray-400 italic"
  >
    No images available
  </div>
  <div
    v-else
    class="relative group"
  >
    <div
      class="relative aspect-[16/9] rounded-2xl overflow-hidden shadow-lg bg-gray-100 dark:bg-gray-800"
      :class="onImageClick ? 'cursor-pointer' : ''"
      @click="onImageClick?.(images[index])"
    >
      <img
        :src="displayImages[index]"
        class="w-full h-full object-contain transition-opacity duration-300 pointer-events-none"
        :alt="index === 0 ? imageAlt : `${imageAlt} (${index + 1})`"
        :fetchpriority="index === 0 ? 'high' : undefined"
        width="960"
        height="540"
        loading="eager"
      />

      <template v-if="displayImages.length > 1">
        <button
          type="button"
          class="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg text-gray-800 transition-all"
          @click.stop="index = index === 0 ? displayImages.length - 1 : index - 1"
        >
          ←
        </button>
        <button
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg text-gray-800 transition-all"
          @click.stop="index = index === displayImages.length - 1 ? 0 : index + 1"
        >
          →
        </button>
        <div
          class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 bg-black/20 rounded-full backdrop-blur"
        >
          <div
            v-for="(dot, i) in displayImages"
            :key="i"
            class="w-1.5 h-1.5 rounded-full transition-all"
            :class="i === index ? 'bg-[#007a67] w-3' : 'bg-white/60'"
          />
        </div>
      </template>
    </div>
  </div>
</template>
