/**
 * Inject or update <meta name="last-modified"> with today's date (Hong Kong timezone).
 */
export function todayHongKong() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong' }).format(new Date());
}

export function injectLastModified(html, date = todayHongKong()) {
  const tag = `<meta name="last-modified" content="${date}">`;
  const existing = /<meta\s+name=["']last-modified["'][^>]*>/i;

  if (existing.test(html)) {
    return html.replace(existing, tag);
  }

  if (/<meta\s+name=["']revisit-after["']/i.test(html)) {
    return html.replace(
      /(\s*<meta\s+name=["']revisit-after["'])/i,
      `\n  ${tag}$1`
    );
  }

  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}
