/**
 * Blog page SEO builders (prerender + Vite middleware).
 */
import { BRAND } from './venueOgMeta.js';

const DEFAULT_OG_IMAGE_PATH = '/gray-G.png';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function defaultImage(origin) {
  return `${(origin || '').replace(/\/$/, '')}${DEFAULT_OG_IMAGE_PATH}`;
}

function jsonLdString(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function formatDateLabel(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function buildBlogListPageMeta({ posts = [], origin, lang = 'en' } = {}) {
  const base = (origin || '').replace(/\/$/, '');
  const pageUrl = `${base}/blog`;
  const title = lang === 'zh'
    ? `網誌 | ${BRAND}`
    : `Blog | ${BRAND}`;
  const description = lang === 'zh'
    ? 'Courts 網誌：香港運動場地貼士、場館資訊及社群故事。'
    : 'Courts blog: Hong Kong sports court tips, venue guides, and community stories.';
  const items = (posts || []).slice(0, 20).map((post, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: post.title,
    url: `${base}/blog/${post.slug}`,
  }));

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${BRAND} Blog`,
      url: pageUrl,
      publisher: { '@type': 'Organization', name: BRAND },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: items,
    },
  ];

  const links = (posts || [])
    .slice(0, 40)
    .map((post) => {
      const href = `${base}/blog/${post.slug}`;
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(post.title)}</a></li>`;
    })
    .join('');

  const staticBodyHtml = links
    ? `<noscript data-seo-crawl-links="1"><nav aria-label="Blog"><ul>${links}</ul></nav></noscript>`
    : '';

  return {
    title,
    description,
    canonical: pageUrl,
    ogType: 'website',
    ogTitle: title,
    ogDescription: description,
    ogUrl: pageUrl,
    ogImage: defaultImage(base),
    twitterCard: 'summary_large_image',
    jsonLd,
    staticBodyHtml,
  };
}

export function buildBlogPostPageMeta(post, { origin, lang = 'en' } = {}) {
  const base = (origin || '').replace(/\/$/, '');
  const slug = post?.slug || '';
  const pageUrl = `${base}/blog/${slug}`;
  const title = `${post?.title || 'Blog'} | ${BRAND}`;
  const description = (post?.summary || '').trim()
    || (lang === 'zh' ? 'Courts 網誌文章' : 'Courts blog article');
  const image = post?.cover_url || defaultImage(base);
  const published = formatDateLabel(post?.published_at);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post?.title || '',
    description,
    image: image ? [image] : undefined,
    datePublished: published || undefined,
    dateModified: formatDateLabel(post?.updated_at || post?.synced_at) || published || undefined,
    author: { '@type': 'Organization', name: BRAND },
    publisher: { '@type': 'Organization', name: BRAND },
    mainEntityOfPage: pageUrl,
    url: pageUrl,
  };

  const bodySnippet = String(post?.body_html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);

  const staticBodyHtml = `<article data-seo-crawl-article="1"><h1>${escapeHtml(post?.title || '')}</h1><p>${escapeHtml(description)}</p><p>${escapeHtml(bodySnippet)}</p></article>`;

  return {
    title,
    description,
    canonical: pageUrl,
    ogType: 'article',
    ogTitle: title,
    ogDescription: description,
    ogUrl: pageUrl,
    ogImage: image,
    twitterCard: 'summary_large_image',
    jsonLd: [jsonLd],
    staticBodyHtml,
  };
}

export function blogPostLastmod(post) {
  const raw = post?.updated_at || post?.synced_at || post?.published_at;
  if (!raw) return new Date().toISOString().slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}
