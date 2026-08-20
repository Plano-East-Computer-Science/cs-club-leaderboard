/**
 * Distance filtering for in-person opportunities.
 *
 * Rule: anything a student would have to commute to must be within
 * RADIUS_MILES of the school. Online and residential programs skip the check --
 * neither requires a drive from Plano.
 *
 * No Node APIs here, so this file runs unchanged in both the Worker and the
 * GitHub Action that does the weekly scrape.
 */

export const SCHOOL = {
  name: 'Plano East Senior High School',
  address: '3000 Los Rios Blvd, Plano, TX 75074',
  lat: 33.0357,
  lng: -96.6689,
};

export const RADIUS_MILES = 15;

const EARTH_RADIUS_MI = 3958.8;
const rad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in miles between two lat/lng pairs. */
export function haversineMiles(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(a));
}

/** Miles from the school. */
export function milesFromSchool(lat, lng) {
  return haversineMiles(SCHOOL.lat, SCHOOL.lng, lat, lng);
}

/**
 * Looks up coordinates for a free-text address using Nominatim (OpenStreetMap).
 * Free, no API key. Returns null on any failure -- callers treat that as
 * "unknown", never as "too far".
 */
export async function geocode(query, { fetchImpl = fetch } = {}) {
  if (!query || !query.trim()) return null;
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
    encodeURIComponent(query);
  try {
    const res = await fetchImpl(url, {
      headers: {
        // Nominatim's usage policy requires identifying the application.
        'User-Agent': 'PlanoEastCSClub-Leaderboard/1.0 (school club site)',
        'Accept-Language': 'en',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json) || !json.length) return null;
    return { lat: Number(json[0].lat), lng: Number(json[0].lon) };
  } catch {
    return null;
  }
}

/**
 * Decides whether an opportunity is close enough to show.
 *
 * Returns { keep, distance_mi, lat, lng, needs_review, why }.
 * An in-person listing we cannot geocode is kept but flagged, so a human
 * decides rather than silently losing a good opportunity.
 */
export async function withinRadius(opp, { geocodeImpl = geocode } = {}) {
  const format = opp.format ?? 'online';

  if (format !== 'local') {
    return { keep: true, distance_mi: null, lat: null, lng: null, needs_review: 0, why: format };
  }

  let lat = opp.lat;
  let lng = opp.lng;
  if (lat == null || lng == null) {
    const hit = await geocodeImpl(opp.location);
    if (!hit) {
      return {
        keep: true,
        distance_mi: null,
        lat: null,
        lng: null,
        needs_review: 1,
        why: 'could not locate address',
      };
    }
    lat = hit.lat;
    lng = hit.lng;
  }

  const distance_mi = Math.round(milesFromSchool(lat, lng) * 10) / 10;
  return {
    keep: distance_mi <= RADIUS_MILES,
    distance_mi,
    lat,
    lng,
    needs_review: 0,
    why: distance_mi <= RADIUS_MILES ? 'within radius' : `${distance_mi} mi away`,
  };
}

/** Stable dedupe key so re-running ingest never creates a second copy. */
export function fingerprintOf(o) {
  const host = (() => {
    try {
      return new URL(o.url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  return `${host}|${(o.title || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
}
