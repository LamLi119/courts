/**
 * Orchestrate Notion → MySQL blog sync.
 */
import {
  createNotionClient,
  fetchAllBlocks,
  fetchPublishedNotionPages,
} from './notionBlog.js';
import { blocksToHtml, copyCoverToGcs } from './notionBlocksToHtml.js';
import {
  deleteBlogPostsNotIn,
  getAllPublishedSlugs,
  upsertBlogPost,
} from './blogRepo.js';
import { submitIndexNowUrls } from '../lib/indexnow.js';

function blogPublicUrl(slug, baseUrl) {
  const base = (baseUrl || process.env.SITEMAP_BASE_URL || 'https://courts.theground.io').replace(/\/$/, '');
  return `${base}/blog/${slug}`;
}

export async function syncBlogFromNotion(db) {
  const pages = await fetchPublishedNotionPages();
  const notion = createNotionClient();
  const syncedIds = [];
  const changedUrls = [];
  const baseUrl = process.env.SITEMAP_BASE_URL || 'https://courts.theground.io';

  const existingSlugs = new Set(await getAllPublishedSlugs(db));

  for (const page of pages) {
    const blocks = await fetchAllBlocks(notion, page.id);
    const cover_url = await copyCoverToGcs(page.coverSourceUrl, page.id);
    const coverVersion = page.notionLastEdited
      ? new Date(page.notionLastEdited).getTime()
      : Date.now();
    const body_html = await blocksToHtml(blocks, page.id, undefined, {
      coverUrl: cover_url,
      coverSourceUrl: page.coverSourceUrl,
    });

    await upsertBlogPost(db, {
      id: page.id,
      slug: page.slug,
      title: page.title,
      summary: page.summary,
      cover_url: cover_url ? `${cover_url}${cover_url.includes('?') ? '&' : '?'}v=${coverVersion}` : null,
      body_html,
      status: 'Published',
      published_at: page.publishedAt || page.notionLastEdited,
      notion_last_edited: page.notionLastEdited,
    });

    syncedIds.push(page.id);
    changedUrls.push(blogPublicUrl(page.slug, baseUrl));
    if (!existingSlugs.has(page.slug)) {
      changedUrls.push(`${baseUrl.replace(/\/$/, '')}/blog`);
    }
  }

  const removed = await deleteBlogPostsNotIn(db, syncedIds);

  submitIndexNowUrls(changedUrls).catch(() => {});

  return {
    synced: syncedIds.length,
    removed,
    slugs: pages.map((p) => p.slug),
  };
}
