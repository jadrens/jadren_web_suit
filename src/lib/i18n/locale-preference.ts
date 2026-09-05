export type GlobalLocale = "en" | "zh";

const STORAGE_KEY = "locale";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isGlobalLocale(value: string | null): value is GlobalLocale {
  return value === "en" || value === "zh";
}

export function normalizeGlobalLocale(language: string): GlobalLocale {
  return language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function getBaseHostname(hostname: string) {
  const labels = hostname.split(".");
  return labels.length > 1 && ["main", "blog", "tool"].includes(labels[0])
    ? labels.slice(1).join(".")
    : hostname;
}

function readLocaleCookie(): GlobalLocale | null {
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${STORAGE_KEY}=`))
    ?.slice(STORAGE_KEY.length + 1) ?? null;

  return isGlobalLocale(value) ? value : null;
}

export function readGlobalLocale(): GlobalLocale {
  const cookieLocale = readLocaleCookie();
  if (cookieLocale) return cookieLocale;

  const storedLocale = localStorage.getItem(STORAGE_KEY);
  if (isGlobalLocale(storedLocale)) return storedLocale;

  return normalizeGlobalLocale(navigator.language);
}

export function writeGlobalLocale(locale: GlobalLocale) {
  localStorage.setItem(STORAGE_KEY, locale);

  const baseHostname = getBaseHostname(window.location.hostname);
  const domain = baseHostname ? `; Domain=${baseHostname}` : "";
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${STORAGE_KEY}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${domain}${secure}`;
}

export function subscribeToGlobalLocale(onChange: (locale: GlobalLocale) => void) {
  const sync = () => onChange(readGlobalLocale());
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) sync();
  };
  const handleVisibility = () => {
    if (document.visibilityState === "visible") sync();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener("focus", sync);
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("focus", sync);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
