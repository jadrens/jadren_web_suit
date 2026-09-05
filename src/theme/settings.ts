export type ThemeMode = "automatic" | "system" | "manual";
export type LocationSource = "manual" | "geolocation" | "ip";
export interface ThemeCoordinates { latitude: number; longitude: number; source: LocationSource }
export interface SolarCache { date: string; latitude: number; longitude: number; sunrise: number; sunset: number }

export const MODE_KEY = "theme-mode";
export const COORDINATES_KEY = "theme-coordinates";
export const SOLAR_KEY = "theme-solar-cache";

const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function eventUtc(date: Date, latitude: number, longitude: number, sunrise: boolean) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  const lngHour = longitude / 15;
  const t = day + ((sunrise ? 6 : 18) - lngHour) / 24;
  const anomaly = 0.9856 * t - 3.289;
  let lng = (anomaly + 1.916 * Math.sin(anomaly * Math.PI / 180) + 0.02 * Math.sin(2 * anomaly * Math.PI / 180) + 282.634 + 360) % 360;
  let ascension = (Math.atan(0.91764 * Math.tan(lng * Math.PI / 180)) * 180 / Math.PI + 360) % 360;
  ascension = (ascension + Math.floor(lng / 90) * 90 - Math.floor(ascension / 90) * 90) / 15;
  const sinDec = 0.39782 * Math.sin(lng * Math.PI / 180);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833 * Math.PI / 180) - sinDec * Math.sin(latitude * Math.PI / 180)) / (cosDec * Math.cos(latitude * Math.PI / 180));
  if (cosH < -1 || cosH > 1) return null;
  const hour = (sunrise ? 360 - Math.acos(cosH) * 180 / Math.PI : Math.acos(cosH) * 180 / Math.PI) / 15;
  const utcHours = ((hour + ascension - 0.06571 * t - 6.622 - lngHour) % 24 + 24) % 24;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + utcHours * 3600000;
}

export function calculateSolar(coordinates: ThemeCoordinates, now = new Date()): SolarCache | null {
  const calendar = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const sunrise = eventUtc(calendar, coordinates.latitude, coordinates.longitude, true);
  const sunset = eventUtc(calendar, coordinates.latitude, coordinates.longitude, false);
  return sunrise === null || sunset === null ? null : { date: dateKey(now), ...coordinates, sunrise, sunset };
}

export function currentAutomaticTheme(coordinates: ThemeCoordinates): "light" | "dark" | null {
  let cache: SolarCache | null = null;
  try { cache = JSON.parse(localStorage.getItem(SOLAR_KEY) || "null"); } catch { /* recalculate */ }
  if (!cache || cache.date !== dateKey() || cache.latitude !== coordinates.latitude || cache.longitude !== coordinates.longitude) {
    cache = calculateSolar(coordinates);
    if (cache) localStorage.setItem(SOLAR_KEY, JSON.stringify(cache));
  }
  return cache ? (Date.now() >= cache.sunrise && Date.now() < cache.sunset ? "light" : "dark") : null;
}
