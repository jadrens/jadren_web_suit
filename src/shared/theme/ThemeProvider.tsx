"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const STORAGE_KEY = "theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
});

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

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

function writeThemeCookie(theme: Theme) {
  const baseHostname = getBaseHostname(window.location.hostname);
  const domain = baseHostname && !baseHostname.includes(":")
    ? `; Domain=${baseHostname}`
    : "";

  document.cookie = `${STORAGE_KEY}=${theme}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${domain}`;
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const hasExplicitTheme = useRef(false);

  useEffect(() => {
    const cookieTheme = readThemeCookie();
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    hasExplicitTheme.current = Boolean(cookieTheme || isTheme(storedTheme));
    setTheme(getInitialTheme());
    setMounted(true);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      if (!hasExplicitTheme.current) {
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

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  }, [mounted, theme]);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      hasExplicitTheme.current = true;
      localStorage.setItem(STORAGE_KEY, next);
      writeThemeCookie(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {mounted ? children : <div style={{ visibility: "hidden" }} />}
    </ThemeContext.Provider>
  );
}
