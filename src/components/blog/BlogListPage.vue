<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { BlogPostSummary, Language } from '../../../types';
import { db } from '../../../db';
import AppFooter from '../layout/AppFooter.vue';

const props = defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  setLanguage: (l: Language) => void;
}>();

const router = useRouter();
const posts = ref<BlogPostSummary[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(props.language === 'zh' ? 'zh-HK' : 'en-HK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function openPost(slug: string) {
  router.push(`/blog/${slug}`);
}

onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    posts.value = await db.getBlogPosts();
  } catch (err: any) {
    error.value = err?.message || 'Failed to load blog posts';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div
    class="w-full min-h-[calc(100vh-4rem)] flex flex-col"
    :class="darkMode ? 'bg-gray-800' : 'bg-gray-50'"
  >
    <div class="flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14">
      <header class="mb-10 md:mb-12">
        <p class="text-xs font-bold uppercase tracking-[0.2em] mb-3" :class="darkMode ? 'text-green-300' : 'text-[#007a67]'">
          {{ t('blogEyebrow') }}
        </p>
        <h1 class="text-3xl md:text-5xl font-black tracking-tight" :class="darkMode ? 'text-white' : 'text-gray-900'">
          {{ t('blogHeading') }}
        </h1>
        <p class="mt-4 text-base md:text-lg max-w-2xl" :class="darkMode ? 'text-gray-300' : 'text-gray-600'">
          {{ t('blogIntro') }}
        </p>
      </header>

      <p v-if="loading" class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
        {{ t('blogLoading') }}
      </p>
      <p v-else-if="error" class="text-sm text-red-500 font-semibold">{{ error }}</p>
      <p v-else-if="posts.length === 0" class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
        {{ t('blogEmpty') }}
      </p>

      <div v-else class="grid gap-8 md:grid-cols-2">
        <article
          v-for="post in posts"
          :key="post.slug"
          class="p-4 group cursor-pointer shadow-md rounded-lg transition-shadow duration-300"
          :class="darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'"
          @click="openPost(post.slug)"
        >
          <a
            :href="`/blog/${post.slug}`"
            class="block no-underline"
            @click.prevent="openPost(post.slug)"
          >
            <div
              v-if="post.cover_url"
              class="aspect-[16/9] overflow-hidden mb-4 bg-gray-100 rounded-2xl shadow-md"
              :class="darkMode ? 'bg-gray-800' : 'bg-gray-100'"
            >
              <img
                :src="post.cover_url"
                :alt="post.title"
                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                loading="lazy"
              />
            </div>
            <time
              v-if="post.published_at"
              class="text-xs font-semibold uppercase tracking-wide text-[#007a67]"
              :datetime="post.published_at"
            >
              {{ formatDate(post.published_at) }}
            </time>
            <h2
              class="mt-2 text-xl md:text-2xl font-black leading-tight transition-colors group-hover:text-[#007a67]"
              :class="darkMode ? 'text-white' : 'text-gray-900'"
            >
              {{ post.title }}
            </h2>
            
            <span class="mt-4 inline-flex text-sm font-bold text-[#007a67]">
              {{ t('blogReadMore') }} →
            </span>
          </a>
        </article>
      </div>
    </div>

    <AppFooter
      :language="language"
      :t="t"
      :dark-mode="darkMode"
      :set-language="setLanguage"
      variant="landing"
    />
  </div>
</template>
