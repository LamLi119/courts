/**
 * Convert Notion blocks to sanitized HTML; copy images to GCS.
 */
import sanitizeHtml from 'sanitize-html';
import { copyRemoteImageToBlogGcs } from './blogImageUpload.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plainTextFromRichText(richText) {
  if (!Array.isArray(richText)) return '';
  return richText.map((t) => t?.plain_text || '').join('');
}

function richTextToHtml(richText) {
  if (!Array.isArray(richText)) return '';
  return richText
    .map((t) => {
      let text = escapeHtml(t?.plain_text || '');
      if (!text) return '';
      const annotations = t.annotations || {};
      if (annotations.code) text = `<code>${text}</code>`;
      if (annotations.bold) text = `<strong>${text}</strong>`;
      if (annotations.italic) text = `<em>${text}</em>`;
      if (annotations.strikethrough) text = `<s>${text}</s>`;
      if (annotations.underline) text = `<u>${text}</u>`;
      const href = t.href || t?.text?.link?.url;
      if (href) {
        const safeHref = escapeHtml(href);
        text = `<a href="${safeHref}" rel="noopener noreferrer" target="_blank">${text}</a>`;
      }
      return text;
    })
    .join('');
}

function sanitizeArticleHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 's', 'u', 'code', 'pre', 'blockquote',
      'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'hr', 'a', 'img', 'figure', 'figcaption',
      'div', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
      img: ['src', 'alt', 'loading', 'width', 'height'],
      figure: ['class'],
      figcaption: ['class'],
      div: ['class'],
      blockquote: ['class'],
      pre: ['class'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  });
}

async function resolveImageUrl(block, pageId, copyImage) {
  const image = block.image || {};
  let sourceUrl = null;
  if (image.type === 'file' && image.file?.url) sourceUrl = image.file.url;
  if (image.type === 'external' && image.external?.url) sourceUrl = image.external.url;
  if (!sourceUrl) return null;
  return copyImage(sourceUrl, pageId, block.id);
}

function readBlockImageSourceUrl(block) {
  const image = block?.image || {};
  if (image.type === 'file' && image.file?.url) return image.file.url;
  if (image.type === 'external' && image.external?.url) return image.external.url;
  return null;
}

function normalizeComparableUrl(value) {
  if (!value) return '';
  return String(value).trim().replace(/[?#].*$/, '');
}

function renderList(items, tag) {
  if (!items.length) return '';
  const inner = items.map((item) => `<li>${item}</li>`).join('');
  return `<${tag}>${inner}</${tag}>`;
}

async function blockToHtml(block, pageId, copyImage, options = {}) {
  const type = block.type;
  const data = block[type] || {};

  if (type === 'paragraph') {
    const inner = richTextToHtml(data.rich_text);
    return inner ? `<p>${inner}</p>` : '';
  }

  if (type === 'heading_1') {
    const inner = richTextToHtml(data.rich_text);
    return inner ? `<h1>${inner}</h1>` : '';
  }
  if (type === 'heading_2') {
    const inner = richTextToHtml(data.rich_text);
    return inner ? `<h2>${inner}</h2>` : '';
  }
  if (type === 'heading_3') {
    const inner = richTextToHtml(data.rich_text);
    return inner ? `<h3>${inner}</h3>` : '';
  }

  if (type === 'bulleted_list_item') {
    const inner = richTextToHtml(data.rich_text);
    const childHtml = block.children?.length
      ? await blocksToHtml(block.children, pageId, copyImage, options)
      : '';
    return `<li>${inner}${childHtml}</li>`;
  }

  if (type === 'numbered_list_item') {
    const inner = richTextToHtml(data.rich_text);
    const childHtml = block.children?.length
      ? await blocksToHtml(block.children, pageId, copyImage, options)
      : '';
    return `<li>${inner}${childHtml}</li>`;
  }

  if (type === 'to_do') {
    const checked = data.checked ? ' checked' : '';
    const inner = richTextToHtml(data.rich_text);
    return `<li><label><input type="checkbox" disabled${checked} /> ${inner}</label></li>`;
  }

  if (type === 'quote') {
    const inner = richTextToHtml(data.rich_text);
    return inner ? `<blockquote>${inner}</blockquote>` : '';
  }

  if (type === 'callout') {
    const inner = richTextToHtml(data.rich_text);
    const icon = data.icon?.emoji ? `${data.icon.emoji} ` : '';
    return inner ? `<blockquote class="blog-callout">${icon}${inner}</blockquote>` : '';
  }

  if (type === 'code') {
    const text = plainTextFromRichText(data.rich_text);
    return text ? `<pre><code>${escapeHtml(text)}</code></pre>` : '';
  }

  if (type === 'divider') {
    return '<hr />';
  }

  if (type === 'image') {
    const sourceUrl = readBlockImageSourceUrl(block);
    const normalizedSource = normalizeComparableUrl(sourceUrl);
    if (!options.coverConsumed && normalizedSource && normalizedSource === normalizeComparableUrl(options.coverSourceUrl)) {
      options.coverConsumed = true;
      return '';
    }
    const src = await resolveImageUrl(block, pageId, copyImage);
    if (!src) return '';
    const normalizedSrc = normalizeComparableUrl(src);
    if (!options.coverConsumed && normalizedSrc && normalizedSrc === normalizeComparableUrl(options.coverUrl)) {
      options.coverConsumed = true;
      return '';
    }
    const caption = plainTextFromRichText(data.caption);
    const alt = escapeHtml(caption || 'Blog image');
    const img = `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" />`;
    if (caption) {
      return `<figure>${img}<figcaption>${escapeHtml(caption)}</figcaption></figure>`;
    }
    return `<figure>${img}</figure>`;
  }

  if (type === 'bookmark' || type === 'link_preview') {
    const url = data.url || data.link?.url;
    if (!url) return '';
    const label = plainTextFromRichText(data.caption) || url;
    return `<p><a href="${escapeHtml(url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(label)}</a></p>`;
  }

  if (type === 'toggle') {
    const inner = richTextToHtml(data.rich_text);
    const childHtml = block.children?.length
      ? await blocksToHtml(block.children, pageId, copyImage, options)
      : '';
    return inner || childHtml ? `<div class="blog-toggle"><p><strong>${inner}</strong></p>${childHtml}</div>` : '';
  }

  if (type === 'child_page' || type === 'child_database') {
    return '';
  }

  // Unsupported: video, equation, embed, column, table, etc.
  if (data?.url) {
    return `<p><a href="${escapeHtml(data.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(data.url)}</a></p>`;
  }

  return '';
}

async function groupListBlocks(blocks, pageId, copyImage, options = {}) {
  const parts = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const type = block.type;
    if (type === 'bulleted_list_item') {
      const items = [];
      while (i < blocks.length && blocks[i].type === 'bulleted_list_item') {
        items.push(await blockToHtml(blocks[i], pageId, copyImage, options));
        i += 1;
      }
      parts.push(renderList(items.filter(Boolean), 'ul'));
      continue;
    }
    if (type === 'numbered_list_item') {
      const items = [];
      while (i < blocks.length && blocks[i].type === 'numbered_list_item') {
        items.push(await blockToHtml(blocks[i], pageId, copyImage, options));
        i += 1;
      }
      parts.push(renderList(items.filter(Boolean), 'ol'));
      continue;
    }
    if (type === 'to_do') {
      const items = [];
      while (i < blocks.length && blocks[i].type === 'to_do') {
        items.push(await blockToHtml(blocks[i], pageId, copyImage, options));
        i += 1;
      }
      parts.push(renderList(items.filter(Boolean), 'ul'));
      continue;
    }
    parts.push(await blockToHtml(block, pageId, copyImage, options));
    i += 1;
  }
  return parts.filter(Boolean).join('\n');
}

export async function blocksToHtml(blocks, pageId, copyImage = copyRemoteImageToBlogGcs, options = {}) {
  const html = await groupListBlocks(blocks || [], pageId, copyImage, options);
  return sanitizeArticleHtml(html);
}

export async function copyCoverToGcs(sourceUrl, pageId) {
  if (!sourceUrl) return null;
  try {
    return await copyRemoteImageToBlogGcs(sourceUrl, pageId, 'cover');
  } catch (err) {
    console.warn(`[blog] cover upload failed for ${pageId}:`, err?.message || err);
    return null;
  }
}
