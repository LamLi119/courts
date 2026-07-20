/**
 * Shared public catalog loader for sitemap, OKF, and related discovery endpoints.
 */

export async function loadPublicCatalog(db, { listSportsRows } = {}) {
  let sports = [];
  if (typeof listSportsRows === 'function') {
    try {
      sports = await listSportsRows(db);
    } catch (err) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
    }
  }

  const [venues] = await db.execute(
    'SELECT * FROM venues ORDER BY sort_order IS NULL, sort_order ASC, name ASC'
  );

  try {
    let sportsRows = sports;
    if (!sportsRows.length) {
      try {
        [sportsRows] = await db.execute('SELECT id, name, name_zh, slug FROM sports ORDER BY name');
      } catch (_) {
        const [fallback] = await db.execute('SELECT id, name, slug FROM sports ORDER BY name').catch(() => [[]]);
        sportsRows = (fallback || []).map((s) => ({ ...s, name_zh: null }));
      }
    }

    const [vsRows] = await db.execute('SELECT venue_id, sport_id, sort_order FROM venue_sports');
    const sportsById = Object.fromEntries((sportsRows || []).map((s) => [s.id, s]));
    const byVenue = {};

    (vsRows || []).forEach((vs) => {
      if (!byVenue[vs.venue_id]) byVenue[vs.venue_id] = [];
      const sport = sportsById[vs.sport_id];
      if (!sport) return;
      byVenue[vs.venue_id].push({
        sport_id: sport.id,
        name: sport.name,
        name_zh: sport.name_zh ?? null,
        slug: sport.slug,
        sort_order: vs.sort_order,
      });
    });

    (venues || []).forEach((venue) => {
      venue.sport_data = byVenue[venue.id] || [];
      delete venue.admin_password;
    });
  } catch (_) {
    (venues || []).forEach((venue) => {
      delete venue.admin_password;
    });
  }

  return { sports: sports || [], venues: venues || [] };
}
