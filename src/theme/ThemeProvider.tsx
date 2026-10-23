"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { COORDINATES_KEY, currentAutomaticTheme, MODE_KEY, ThemeCoordinates, ThemeMode } from "./settings";
import { isTheme, RESOLVED_THEME_COOKIE, Theme, THEME_STORAGE_KEY } from "./bootstrap";

export type { Theme };

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  refreshTheme: () => void;
}

const STORAGE_KEY = THEME_STORAGE_KEY;
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

  const storedTheme = localStorage.getItem(STORAGE_KEY);
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
  const hasExplicitTheme = useRef(false);

  // Declared before the mount effect: on the first commit the DOM already carries the theme
  // set by the server / THEME_INIT_SCRIPT, so only sync once the stored preference is resolved.
  useEffect(() => {
    if (!preferenceApplied.current) return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    writeThemeCookie(theme, RESOLVED_THEME_COOKIE);
  }, [theme]);

  useEffect(() => {
    applyPreference();
    preferenceApplied.current = true;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      if (localStorage.getItem(MODE_KEY) === "system") {
        setTheme(event.matches ? "dark" : "light");
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isTheme(event.newValue)) {
        hasExplicitTheme.current = true;
        setTheme(event.newValue);
      }
    };

    media.addEventListener("change", handleSystemThemeChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      media.removeEventListener("change", handleSystemThemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const applyPreference = () => {
    const savedMode = localStorage.getItem(MODE_KEY);
    const nextMode: ThemeMode = savedMode === "automatic" || savedMode === "manual" || savedMode === "system" ? savedMode : "system";
    setModeState(nextMode);
    if (nextMode === "system") setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    else if (nextMode === "manual") setTheme(getInitialTheme());
    else {
      try {
        const coordinates = JSON.parse(localStorage.getItem(COORDINATES_KEY) || "null") as ThemeCoordinates | null;
        const automatic = coordinates && currentAutomaticTheme(coordinates);
        if (automatic) setTheme(automatic);
      } catch { /* keep current theme */ }
    }
  };

  const toggleTheme = () => {
    localStorage.setItem(MODE_KEY, "manual");
    setModeState("manual");
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      hasExplicitTheme.current = true;
      localStorage.setItem(STORAGE_KEY, next);
      writeThemeCookie(next);
      return next;
    });
  };

  const setMode = (next: ThemeMode) => {
    localStorage.setItem(MODE_KEY, next);
    setModeState(next);
    queueMicrotask(applyPreference);
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme, setMode, refreshTheme: applyPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
