"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { COORDINATES_KEY, currentAutomaticTheme, MODE_KEY, ThemeCoordinates, ThemeMode } from "./settings";
import { isTheme, RESOLVED_THEME_COOKIE, Theme, THEME_STORAGE_KEY } from "./bootstrap";

export type { Theme };

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  /** origin: viewport point (e.g. the clicked button) the new theme spreads from. */
  toggleTheme: (origin?: ThemeTransitionOrigin) => void;
  setMode: (mode: ThemeMode) => void;
  refreshTheme: () => void;
}

export interface ThemeTransitionOrigin { x: number; y: number }

const STORAGE_KEY = THEME_STORAGE_KEY;
const TRANSITION_CLASS = "theme-transition";
const TRANSITION_MS = 750;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  mode: "system",
  toggleTheme: () => {},
  setMode: () => {},
  refreshTheme: () => {},
});

function getBaseHostname(hostname: string) {
  const labels = hostname.split(".");
  return labels.length > 1 && ["main", "blog", "tool"].includes(labels[0])
    ? labels.slice(1).join(".")
    : hostname;
}

function readThemeCookie() {
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${STORAGE_KEY}=`))
    ?.split("=")[1] ?? null;

  return isTheme(value) ? value : null;
}

function writeThemeCookie(theme: Theme, name = STORAGE_KEY) {
  const baseHostname = getBaseHostname(window.location.hostname);
  const domain = baseHostname && !baseHostname.includes(":")
    ? `; Domain=${baseHostname}`
    : "";

  document.cookie = `${name}=${theme}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${domain}`;
}

function getInitialTheme(): Theme {
  const cookieTheme = readThemeCookie();
  if (cookieTheme) return cookieTheme;

  let storedTheme: string | null = null;
  try { storedTheme = localStorage.getItem(STORAGE_KEY); } catch { /* storage may be disabled */ }
  if (isTheme(storedTheme)) return storedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  return useContext(ThemeContext);
}

// initialTheme comes from the server (RESOLVED_THEME_COOKIE), so SSR output and the first client render agree.
export function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [mode, setModeState] = useState<ThemeMode>("system");
  const preferenceApplied = useRef(false);
  const modeRef = useRef<ThemeMode>("system");
  const readStorage = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
  const writeStorage = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* keep the in-memory preference */ } };

  const applyPreference = (override?: ThemeMode) => {
    const savedMode = override ?? readStorage(MODE_KEY);
    const nextMode: ThemeMode = savedMode === "automatic" || savedMode === "manual" || savedMode === "system" ? savedMode : "system";
    modeRef.current = nextMode;
    setModeState(nextMode);
    if (nextMode === "system") setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    else if (nextMode === "manual") setTheme(getInitialTheme());
    else {
      try {
        const coordinates = JSON.parse(readStorage(COORDINATES_KEY) || "null") as ThemeCoordinates | null;
        const automatic = coordinates && currentAutomaticTheme(coordinates);
        if (automatic) setTheme(automatic);
      } catch { /* keep current theme */ }
    }
  };

  // Declared before the mount effect: on the first commit the DOM already carries the theme
  // set by the server / THEME_INIT_SCRIPT, so only sync once the stored preference is resolved.
  useEffect(() => {
    if (!preferenceApplied.current) return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    writeThemeCookie(theme, RESOLVED_THEME_COOKIE);
  }, [theme]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the stored preference is only readable after hydration.
    applyPreference();
    preferenceApplied.current = true;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      if (modeRef.current === "system") {
        setTheme(event.matches ? "dark" : "light");
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isTheme(event.newValue) && modeRef.current === "manual") setTheme(event.newValue);
      else if (event.key === MODE_KEY || event.key === COORDINATES_KEY || event.key === STORAGE_KEY || event.key === null) applyPreference();
    };
    const refreshAutomatic = () => { if (modeRef.current === "automatic") applyPreference("automatic"); };
    const timer = window.setInterval(refreshAutomatic, 60_000);
    window.addEventListener("focus", refreshAutomatic);

    media.addEventListener("change", handleSystemThemeChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshAutomatic);
      media.removeEventListener("change", handleSystemThemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  // Preference helpers only use stable setters and refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Day/night switch: the new theme spreads from `origin` as a growing circle (View Transitions API).
  // Falls back to the plain CSS color fade when unsupported or when reduced motion is requested.
  const toggleTheme = (origin?: ThemeTransitionOrigin) => {
    writeStorage(MODE_KEY, "manual");
    modeRef.current = "manual";
    setModeState("manual");
    const next: Theme = theme === "light" ? "dark" : "light";
    writeStorage(STORAGE_KEY, next);
    writeThemeCookie(next);

    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition !== "function" || reduceMotion) {
      setTheme(next);
      return;
    }

    // External callers (e.g. the DNS tool's onChange) may pass other arguments; only trust real coordinates.
    const valid = origin && Number.isFinite(origin.x) && Number.isFinite(origin.y);
    const x = valid ? origin.x : window.innerWidth / 2;
    const y = valid ? origin.y : window.innerHeight / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    root.classList.add(TRANSITION_CLASS);
    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(next));
      // Set synchronously so the "new" snapshot is fully themed even before effects run.
      root.setAttribute("data-theme", next);
      root.style.colorScheme = next;
    });

    transition.ready.then(() => {
      const easing = "cubic-bezier(0.65, 0, 0.35, 1)";
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: TRANSITION_MS, easing, pseudoElement: "::view-transition-new(root)" },
      );
      // The old scene dims into night / brightens into day while the new one sweeps over it.
      root.animate(
        { filter: ["brightness(1)", next === "dark" ? "brightness(0.7)" : "brightness(1.25)"] },
        { duration: TRANSITION_MS, easing, pseudoElement: "::view-transition-old(root)" },
      );
    }).catch(() => { /* transition skipped; the theme is already applied */ });

    transition.finished.finally(() => root.classList.remove(TRANSITION_CLASS));
  };

  const setMode = (next: ThemeMode) => {
    writeStorage(MODE_KEY, next);
    applyPreference(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme, setMode, refreshTheme: () => applyPreference(modeRef.current) }}>
      {children}
    </ThemeContext.Provider>
  );
}
