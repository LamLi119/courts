/**
 * Notion API helpers for blog database sync.
 */
import { Client } from '@notionhq/client';

const PUBLISHED_STATUS = 'Published';

function getNotionClient() {
  const token = (process.env.NOTION_API_TOKEN || '').trim();
  if (!token) {
    throw new Error('NOTION_API_TOKEN is not configured');
  }
  return new Client({ auth: token });
}

function getDatabaseId() {
  const id = (process.env.NOTION_BLOG_DATABASE_ID || '').trim();
  if (!id) {
    throw new Error('NOTION_BLOG_DATABASE_ID is not configured');
  }
  const compact = id.replace(/-/g, '');
  if (compact.length !== 32) return id;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function plainTextFromRichText(richText) {
  if (!Array.isArray(richText)) return '';
  return richText.map((t) => t?.plain_text || '').join('');
}

function getProp(page, names) {
  const props = page?.properties || {};
  for (const name of names) {
    if (props[name]) return props[name];
  }
  return null;
}

function readTitle(page) {
  const prop = getProp(page, ['Name', 'Title', 'name', 'title']);
  if (!prop) return '';
  if (prop.type === 'title') return plainTextFromRichText(prop.title);
  return '';
}

function readRichText(page, names) {
  const prop = getProp(page, names);
  if (!prop) return '';
  if (prop.type === 'rich_text') return plainTextFromRichText(prop.rich_text);
  if (prop.type === 'text') return plainTextFromRichText(prop.text);
  return '';
}

function readSelect(page, names) {
  const prop = getProp(page, names);
  if (!prop || prop.type !== 'select' || !prop.select) return '';
  return prop.select.name || '';
}

function readDate(page, names) {
  const prop = getProp(page, names);
  if (!prop || prop.type !== 'date' || !prop.date) return null;
  return prop.date.start || null;
}

function readFileUrl(page, names) {
  const prop = getProp(page, names);
  if (!prop) return null;
  if (prop.type === 'files' && Array.isArray(prop.files) && prop.files.length > 0) {
    const file = prop.files[0];
    if (file.type === 'file' && file.file?.url) return file.file.url;
    if (file.type === 'external' && file.external?.url) return file.external.url;
  }
  return null;
}

function readPageCoverUrl(page) {
  const cover = page?.cover;
  if (!cover) return null;
  if (cover.type === 'external' && cover.external?.url) return cover.external.url;
  if (cover.type === 'file' && cover.file?.url) return cover.file.url;
  return null;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseNotionPage(page) {
  const title = readTitle(page);
  let slug = readRichText(page, ['Slug', 'slug']);
  if (!slug) slug = slugify(title);
  slug = slugify(slug);
  const status = readSelect(page, ['Status', 'status']) || '';
  const summary = readRichText(page, ['Summary', 'summary', 'Excerpt', 'excerpt']);
  const publishedAt = readDate(page, ['Published', 'published', 'Publish date', 'Date']);
  const coverFromProp = readFileUrl(page, ['Cover', 'cover']);
  const coverFromPage = readPageCoverUrl(page);
  const notionLastEdited = page?.last_edited_time || null;

  return {
    id: page.id,
    title,
    slug,
    status,
    summary,
    publishedAt,
    coverSourceUrl: coverFromProp || coverFromPage || null,
    notionLastEdited,
  };
}

export async function fetchPublishedNotionPages() {
  const notion = getNotionClient();
  const database_id = getDatabaseId();
  const pages = [];
  let cursor;

  do {
    const response = await notion.databases.query({
      database_id,
      filter: {
        property: 'Status',
        select: { equals: PUBLISHED_STATUS },
      },
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return pages.map(parseNotionPage).filter((p) => p.slug && p.title);
}

export async function fetchAllBlocks(notion, blockId) {
  const blocks = [];
  let cursor;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...(response.results || []));
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  for (const block of blocks) {
    if (block.has_children) {
      block.children = await fetchAllBlocks(notion, block.id);
    }
  }

  return blocks;
}

export function createNotionClient() {
  return getNotionClient();
}

export { PUBLISHED_STATUS };
