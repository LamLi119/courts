/**
 * Open Knowledge Format (OKF) — markdown corpus + tar.gz bundle of public venue/sport data.
 */

import { gzipSync } from 'zlib';
import { slugifyVenueName } from './sitemap.js';

const DEFAULT_BASE_URL = 'https://courts.theground.io';

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function parseMaybeJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }
  return fallback;
}

function yamlValue(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ');
}

function frontMatter(data) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      value.forEach((item) => lines.push(`  - "${yamlValue(item)}"`));
      continue;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      lines.push(`${key}: ${value}`);
      continue;
    }
    lines.push(`${key}: "${yamlValue(value)}"`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function formatOperatingHours(raw) {
  const hours = parseMaybeJson(raw, null);
  if (!hours || typeof hours !== 'object' || !hours.weekly) return '';
  const dayLabels = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
  };
  const lines = [];
  for (const key of Object.keys(dayLabels)) {
    const day = hours.weekly[key];
    if (!day) continue;
    if (day.closed) {
      lines.push(`- ${dayLabels[key]}: Closed`);
      continue;
    }
    const slots = Array.isArray(day.slots)
      ? day.slots.map((slot) => (Array.isArray(slot) ? slot.join('-') : '')).filter(Boolean)
      : [];
    lines.push(`- ${dayLabels[key]}: ${slots.join(', ') || 'Open'}`);
  }
  if (cleanText(hours.note)) lines.push(`- Note: ${cleanText(hours.note)}`);
  return lines.join('\n');
}

function venueMarkdown(venue, baseUrl) {
  const slug = slugifyVenueName(venue?.name);
  const url = `${baseUrl}/venues/${slug}`;
  const sports = Array.isArray(venue?.sport_data)
    ? venue.sport_data.map((sport) => cleanText(sport?.name || sport?.slug)).filter(Boolean)
    : [];
  const amenities = parseMaybeJson(venue?.amenities, []);
  const pricing = parseMaybeJson(venue?.pricing, null);
  const images = parseMaybeJson(venue?.images, []);
  const coordinates = parseMaybeJson(venue?.coordinates, null);
  const description =
    cleanText(venue?.description) || `${cleanText(venue?.name)} sports venue in Hong Kong.`;

  const body = [
    `# ${cleanText(venue?.name) || 'Venue'}`,
    '',
    description,
    '',
    '## Summary',
    `- URL: ${url}`,
    cleanText(venue?.address) ? `- Address: ${cleanText(venue.address)}` : '',
    cleanText(venue?.mtrStation)
      ? `- MTR: ${cleanText(venue.mtrStation)}${cleanText(venue?.mtrExit) ? ` (${cleanText(venue.mtrExit)})` : ''}`
      : '',
    venue?.walkingDistance != null && venue.walkingDistance !== ''
      ? `- Walking distance: ${venue.walkingDistance} min`
      : '',
    sports.length ? `- Sports: ${sports.join(', ')}` : '',
    venue?.startingPrice != null && venue.startingPrice !== ''
      ? `- Starting price: HKD ${venue.startingPrice}/hr`
      : '',
    venue?.court_count != null && venue.court_count !== ''
      ? `- Court count: ${venue.court_count}`
      : '',
    cleanText(venue?.booking_url) ? `- Booking URL: ${cleanText(venue.booking_url)}` : '',
    cleanText(venue?.whatsapp) ? `- WhatsApp: ${cleanText(venue.whatsapp)}` : '',
    cleanText(venue?.socialLink) ? `- Social: ${cleanText(venue.socialLink)}` : '',
    coordinates?.lat != null && coordinates?.lng != null
      ? `- Coordinates: ${coordinates.lat}, ${coordinates.lng}`
      : '',
    '',
    Array.isArray(amenities) && amenities.length
      ? `## Amenities\n${amenities.map((item) => `- ${cleanText(item)}`).join('\n')}\n`
      : '',
    pricing?.type === 'text' && cleanText(pricing?.content)
      ? `## Pricing\n${cleanText(pricing.content)}\n`
      : '',
    pricing?.type === 'image' && cleanText(pricing?.imageUrl)
      ? `## Pricing Image\n- ${cleanText(pricing.imageUrl)}\n`
      : '',
    Array.isArray(images) && images.length
      ? `## Images\n${images.map((item) => `- ${cleanText(item)}`).join('\n')}\n`
      : '',
    formatOperatingHours(venue?.operating_hours)
      ? `## Operating Hours\n${formatOperatingHours(venue.operating_hours)}\n`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    path: `okf/venues/${slug}.md`,
    content:
      frontMatter({
        type: 'venue',
        title: cleanText(venue?.name),
        description,
        url,
        tags: [...sports, cleanText(venue?.mtrStation)].filter(Boolean),
      }) +
      body +
      '\n',
  };
}

function sportMarkdown(sport, venues, baseUrl) {
  const slug = cleanText(sport?.slug);
  const title = cleanText(sport?.name);
  const supportedVenues = (venues || []).filter(
    (venue) =>
      Array.isArray(venue?.sport_data) &&
      venue.sport_data.some((item) => cleanText(item?.slug) === slug)
  );
  const url = `${baseUrl}/search/${slug}`;
  const body = [
    `# ${title}`,
    '',
    cleanText(sport?.name_zh) ? `Chinese name: ${cleanText(sport.name_zh)}` : '',
    '',
    '## Summary',
    `- URL: ${url}`,
    `- Venue count: ${supportedVenues.length}`,
    '',
    supportedVenues.length
      ? `## Venues\n${supportedVenues
          .map(
            (venue) =>
              `- [${cleanText(venue.name)}](${baseUrl}/venues/${slugifyVenueName(venue.name)})`
          )
          .join('\n')}\n`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    path: `okf/sports/${slug}.md`,
    content:
      frontMatter({
        type: 'sport',
        title,
        description: `${title} venues searchable on Courts.`,
        url,
        tags: [title, cleanText(sport?.name_zh)].filter(Boolean),
      }) +
      body +
      '\n',
  };
}

function createTarBuffer(files) {
  const chunks = [];

  for (const file of files) {
    const content = Buffer.from(file.content, 'utf8');
    const header = Buffer.alloc(512, 0);
    const name = Buffer.from(file.path);
    name.copy(header, 0, 0, Math.min(name.length, 100));
    Buffer.from('0000644\0').copy(header, 100);
    Buffer.from('0000000\0').copy(header, 108);
    Buffer.from('0000000\0').copy(header, 116);
    Buffer.from(content.length.toString(8).padStart(11, '0') + '\0').copy(header, 124);
    Buffer.from(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0').copy(header, 136);
    Buffer.from('        ').copy(header, 148);
    header[156] = '0'.charCodeAt(0);
    Buffer.from('ustar\0').copy(header, 257);
    Buffer.from('00').copy(header, 263);

    let sum = 0;
    for (let i = 0; i < 512; i++) sum += header[i];
    Buffer.from(sum.toString(8).padStart(6, '0') + '\0 ').copy(header, 148);

    chunks.push(header);
    chunks.push(content);
    const remainder = content.length % 512;
    if (remainder) chunks.push(Buffer.alloc(512 - remainder, 0));
  }

  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

/**
 * @param {{ sports?: any[], venues?: any[], baseUrl?: string }} opts
 * @returns {{ files: {path: string, content: string}[], byPath: Record<string, string>, tarGz: Buffer }}
 */
export function buildOkfBundle({ sports = [], venues = [], baseUrl = DEFAULT_BASE_URL } = {}) {
  const origin = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
  const venueFiles = venues
    .map((venue) => venueMarkdown(venue, origin))
    .filter((file) => file.path !== 'okf/venues/.md');
  const sportFiles = sports
    .map((sport) => sportMarkdown(sport, venues, origin))
    .filter((file) => file.path !== 'okf/sports/.md');

  const venueLinks = venueFiles
    .map((file) => {
      const title = file.content.match(/^# (.+)$/m)?.[1] || file.path;
      return `- [${title}](${origin}/${file.path})`;
    })
    .join('\n');

  const sportLinks = sportFiles
    .map((file) => {
      const title = file.content.match(/^# (.+)$/m)?.[1] || file.path;
      return `- [${title}](${origin}/${file.path})`;
    })
    .join('\n');

  const files = [
    {
      path: 'okf/index.md',
      content: [
        '# Courts OKF',
        '',
        'This Open Knowledge Format bundle publishes public Courts venue and sport data for AI agents and tools.',
        '',
        `- Site: ${origin}`,
        `- Generated: ${new Date().toISOString()}`,
        `- Venue count: ${venueFiles.length}`,
        `- Sport count: ${sportFiles.length}`,
        '',
        '## Sections',
        `- [Venues](${origin}/okf/venues/index.md)`,
        `- [Sports](${origin}/okf/sports/index.md)`,
        `- [Change Log](${origin}/okf/log.md)`,
        '',
      ].join('\n'),
    },
    {
      path: 'okf/log.md',
      content: [
        '# OKF Change Log',
        '',
        `- ${new Date().toISOString()}: generated bundle from current public venue and sport catalog.`,
        '',
      ].join('\n'),
    },
    {
      path: 'okf/venues/index.md',
      content: ['# Venues', '', venueLinks || '- No venues available.', ''].join('\n'),
    },
    {
      path: 'okf/sports/index.md',
      content: ['# Sports', '', sportLinks || '- No sports available.', ''].join('\n'),
    },
    ...venueFiles,
    ...sportFiles,
  ];

  const byPath = Object.fromEntries(files.map((file) => [file.path, file.content]));
  const tarGz = gzipSync(createTarBuffer(files));
  return { files, byPath, tarGz };
}
