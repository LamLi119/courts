<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { BlogPost, Language } from '../../../types';
import { db } from '../../../db';
import AppFooter from '../layout/AppFooter.vue';

const props = defineProps<{
  language: Language;
  t: (key: string) => string;
  darkMode: boolean;
  setLanguage: (l: Language) => void;
}>();

const emit = defineEmits<{
  postLoaded: [post: BlogPost];
}>();
const route = useRoute();
const router = useRouter();
const post = ref<BlogPost | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const slug = computed(() => String(route.params.slug || '').trim());

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(props.language === 'zh' ? 'zh-HK' : 'en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function loadPost() {
  if (!slug.value) {
    router.replace('/blog');
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const data = await db.getBlogPost(slug.value);
    if (!data) {
      router.replace('/blog');
      return;
    }
    post.value = data;
    emit('postLoaded', data);
  } catch (err: any) {
    error.value = err?.message || 'Failed to load post';
    post.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(loadPost);
watch(slug, loadPost);
watch(
  () => props.language,
  () => {
    if (post.value) emit('postLoaded', post.value);
  },
);
</script>

<template>
  <div
    class="w-full min-h-[calc(100vh-4rem)] flex flex-col"
    :class="darkMode ? 'bg-gray-900' : 'bg-white'"
  >
    <div class="flex-1 w-full max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14">
      <a
        href="/blog"
        class="inline-flex items-center gap-2 text-sm font-bold text-[#007a67] no-underline mb-8"
        @click.prevent="router.push('/blog')"
      >
        ← {{ t('blogBackToList') }}
      </a>

      <p v-if="loading" class="text-sm" :class="darkMode ? 'text-gray-400' : 'text-gray-500'">
        {{ t('blogLoading') }}
      </p>
      <p v-else-if="error" class="text-sm text-red-500 font-semibold">{{ error }}</p>

      <article v-else-if="post">
        <header class="mb-8">
          <time
            v-if="post.published_at"
            class="text-xs font-semibold uppercase tracking-wide text-[#007a67]"
            :datetime="post.published_at"
          >
            {{ formatDate(post.published_at) }}
          </time>
          <h1
            class="mt-3 text-3xl md:text-5xl font-black tracking-tight leading-tight"
            :class="darkMode ? 'text-white' : 'text-gray-900'"
          >
            {{ post.title }}
          </h1>
          <p
            v-if="post.summary"
            class="mt-4 text-lg leading-relaxed"
            :class="darkMode ? 'text-gray-300' : 'text-gray-600'"
          >
            {{ post.summary }}
          </p>
        </header>

        <div
          v-if="post.cover_url"
          class="mb-10 overflow-hidden"
        >
          <img
            :src="post.cover_url"
            :alt="post.title"
            class="w-full h-auto object-cover"
            loading="eager"
          />
        </div>

        <div
          class="blog-prose"
          :class="darkMode ? 'blog-prose-dark' : 'blog-prose-light'"
          v-html="post.body_html"
        />
      </article>
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

<style scoped>
.blog-prose :deep(p) {
  margin: 0 0 1.25rem;
  line-height: 1.75;
}

.blog-prose :deep(h1),
.blog-prose :deep(h2),
.blog-prose :deep(h3) {
  margin: 2rem 0 1rem;
  font-weight: 800;
  line-height: 1.25;
}

.blog-prose :deep(h1) { font-size: 1.75rem; }
.blog-prose :deep(h2) { font-size: 1.5rem; }
.blog-prose :deep(h3) { font-size: 1.25rem; }

.blog-prose :deep(ul),
.blog-prose :deep(ol) {
  margin: 0 0 1.25rem 1.25rem;
  padding: 0;
}

.blog-prose :deep(li) {
  margin-bottom: 0.5rem;
}

.blog-prose :deep(blockquote) {
  margin: 1.5rem 0;
  padding-left: 1rem;
  border-left: 4px solid #007a67;
  font-style: italic;
}

.blog-prose :deep(.blog-callout) {
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  border-left-width: 4px;
}

.blog-prose :deep(pre) {
  overflow-x: auto;
  padding: 1rem;
  border-radius: 0.75rem;
  margin: 1.5rem 0;
}

.blog-prose :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
}

.blog-prose :deep(figure) {
  margin: 2rem 0;
}

.blog-prose :deep(img) {
  width: 100%;
  height: auto;
  display: block;
}

.blog-prose :deep(figcaption) {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  opacity: 0.75;
}

.blog-prose :deep(a) {
  color: #007a67;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.blog-prose-light :deep(pre),
.blog-prose-light :deep(.blog-callout) {
  background: #f3f4f6;
  color: #111827;
}

.blog-prose-dark :deep(pre),
.blog-prose-dark :deep(.blog-callout) {
  background: #1f2937;
  color: #f3f4f6;
}

.blog-prose-dark :deep(p),
.blog-prose-dark :deep(li) {
  color: #e5e7eb;
}

.blog-prose-light :deep(p),
.blog-prose-light :deep(li) {
  color: #374151;
}
</style>
