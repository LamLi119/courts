const HK_TZ = 'Asia/Hong_Kong';

export function formatSlotTimeHm(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return String(isoString ?? '');
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: HK_TZ,
  });
}

function toCompactDate(isoDate) {
  return String(isoDate).replace(/-/g, '');
}

function dashFromCompact(compact) {
  const s = String(compact);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function toDateDash(date) {
  if (date == null || date === '') return null;
  const s = String(date).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return dashFromCompact(s);
  return null;
}

function normalizeCourtsArray(courts) {
  return (courts || []).map((c) => ({
    courtId: c.courtId ?? c.court_id,
    courtName: c.courtName ?? c.court_name ?? '',
    slots: (c.slots || c.available_hours || []).map((h) => ({
      start: h.start?.includes('T') ? formatSlotTimeHm(h.start) : h.start,
      end: h.end?.includes('T') ? formatSlotTimeHm(h.end) : h.end,
      startIso: h.startIso ?? h.start,
      endIso: h.endIso ?? h.end,
    })),
  }));
}

/**
 * Normalize n8n / 212HK payload for the Courts Finder UI.
 * @param {unknown} body
 * @param {string} requestedDateDash YYYY-MM-DD
 */
export function normalizeAvailabilityPayload(body, requestedDateDash) {
  if (!body || typeof body !== 'object') {
    return {
      supported: false,
      date: requestedDateDash,
      timezone: HK_TZ,
      courts: [],
    };
  }

  const raw = /** @type {Record<string, unknown>} */ (body);

  if (raw.supported === false) {
    return {
      supported: false,
      date: requestedDateDash,
      timezone: HK_TZ,
      courts: [],
      error: typeof raw.error === 'string' ? raw.error : undefined,
    };
  }

  const compact = toCompactDate(requestedDateDash);

  if (Array.isArray(raw.days)) {
    const day = raw.days.find((d) => {
      if (!d) return false;
      const dash = toDateDash(d.date);
      return dash === requestedDateDash || String(d.date) === compact;
    });
    if (day?.courts) {
      return {
        supported: true,
        date: requestedDateDash,
        timezone: HK_TZ,
        provider: raw.provider ? String(raw.provider) : undefined,
        courts: normalizeCourtsArray(day.courts),
      };
    }
  }

  if (Array.isArray(raw.courts)) {
    return {
      supported: raw.supported !== false,
      date: String(raw.date || requestedDateDash),
      timezone: HK_TZ,
      provider: raw.provider ? String(raw.provider) : undefined,
      courts: normalizeCourtsArray(raw.courts),
    };
  }

  if (Array.isArray(body)) {
    const day = body.find((d) => {
      if (!d) return false;
      const dash = toDateDash(d.date);
      return dash === requestedDateDash || String(d.date) === compact;
    });
    if (day?.courts) {
      return {
        supported: true,
        date: requestedDateDash,
        timezone: HK_TZ,
        provider: raw.provider ? String(raw.provider) : undefined,
        courts: normalizeCourtsArray(day.courts),
      };
    }
  }

  if (raw.date && Array.isArray(raw.courts)) {
    const match = String(raw.date) === compact || String(raw.date) === requestedDateDash;
    if (match || !compact) {
      return {
        supported: true,
        date: requestedDateDash,
        timezone: HK_TZ,
        provider: raw.provider ? String(raw.provider) : undefined,
        courts: normalizeCourtsArray(raw.courts),
      };
    }
  }

  return {
    supported: false,
    date: requestedDateDash,
    timezone: HK_TZ,
    courts: [],
    error: 'No availability for this date',
  };
}

export function buildN8nWebhookUrl(baseUrl, venueId, dateDash, secret, days) {
  const u = new URL(baseUrl);
  u.searchParams.set('venueId', String(venueId));
  u.searchParams.set('date', dateDash);
  if (days != null && Number(days) > 1) {
    u.searchParams.set('days', String(days));
  }
  if (secret) u.searchParams.set('secret', secret);
  return u.toString();
}
