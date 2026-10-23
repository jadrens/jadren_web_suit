import { MODE_KEY } from "./settings";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
// Last theme actually applied on the client, so the server can render it on the next request.
export const RESOLVED_THEME_COOKIE = "theme-resolved";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

// Runs before first paint and mirrors ThemeProvider's preference resolution, so the
// server-rendered page never flashes the wrong theme (first visit, OS theme change, etc.).
export const THEME_INIT_SCRIPT = `(function(){try{
var d=document.documentElement,m=localStorage.getItem(${JSON.stringify(MODE_KEY)}),t=null;
function c(n){var r=document.cookie.match(new RegExp("(?:^|; )"+n+"=(light|dark)"));return r&&r[1]}
if(m==="manual")t=c(${JSON.stringify(THEME_STORAGE_KEY)})||localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
else if(m==="automatic")t=c(${JSON.stringify(RESOLVED_THEME_COOKIE)});
if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
d.setAttribute("data-theme",t);d.style.colorScheme=t;
}catch(e){}})();`;
