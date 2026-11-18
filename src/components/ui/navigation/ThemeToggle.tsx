"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconButton } from "@mui/material";
import { useTheme, type Theme } from "@theme/ThemeProvider";
import SunMoonIcon, { sunMoonColor } from "./SunMoonIcon";

// Time for a full sun ↔ moon morph; a reversal mid-way only takes the remaining share of it.
const FULL_MORPH_MS = 650;

// The icon shows the theme you will switch to: sun while dark, moon while light.
const targetFor = (theme: Theme) => (theme === "dark" ? 0 : 100);

export default function ThemeToggle() {
  const { theme, toggleTheme, getRequestedTheme } = useTheme();
  const [progress, setProgress] = useState(() => targetFor(theme));
  const progressRef = useRef(progress);
  const targetRef = useRef(progress);
  const frameRef = useRef(0);
  const mountedRef = useRef(false);

  // Interruptible, time-based tween from the current frame. A click starts it at the click's timestamp,
  // so while the view transition holds painting (snapshot + app re-render) the morph keeps time and
  // shows the right frame as soon as painting resumes, instead of starting only after the commit.
  const animateTo = (target: number, startedAt = performance.now()) => {
    if (target === targetRef.current) return;
    targetRef.current = target;
    cancelAnimationFrame(frameRef.current);
    const set = (value: number) => {
      progressRef.current = value;
      setProgress(value);
    };
    const from = progressRef.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set(target);
      return;
    }
    const duration = (FULL_MORPH_MS * Math.abs(target - from)) / 100;
    frameRef.current = requestAnimationFrame(function step(now) {
      const t = Math.min(1, Math.max(0, (now - startedAt) / duration));
      set(from + (target - from) * t);
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    });
  };

  // Follow theme changes made elsewhere (auto mode, other tabs, settings). Uses the requested theme,
  // not the committed one, so commits lagging behind rapid clicks never pull the icon backwards.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      progressRef.current = targetRef.current = targetFor(theme);
      setProgress(progressRef.current);
      return;
    }
    animateTo(targetFor(getRequestedTheme()));
    // animateTo/getRequestedTheme only read refs; the effect should run on theme commits alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  return (
    <IconButton
      onClick={(event) => {
        const clickedAt = performance.now();
        // Keyboard activation reports (0, 0); spread from the button's center instead.
        const rect = event.currentTarget.getBoundingClientRect();
        const fromPointer = event.clientX !== 0 || event.clientY !== 0;
        const next = toggleTheme({
          x: fromPointer ? event.clientX : rect.left + rect.width / 2,
          y: fromPointer ? event.clientY : rect.top + rect.height / 2,
        });
        animateTo(targetFor(next), clickedAt);
      }}
      sx={{
        width: 40,
        height: 40,
        transition: "box-shadow 0.25s ease, background-color 0.25s ease",
        "& svg": { transition: "filter 0.25s ease" },
        // Lit ring + halo + icon glow, only while hovered (or keyboard-focused).
        "&:hover, &.Mui-focusVisible": {
          backgroundColor: "action.hover",
          boxShadow: "inset 0 0 0 1px var(--glow-ring), inset 0 0 10px var(--glow-soft), 0 0 12px var(--glow-halo)",
          "& svg": { filter: "drop-shadow(0 0 3px var(--glow-icon))" },
        },
      }}
      // Glow tints follow the morph; set per frame as CSS variables via `style` so Emotion doesn't mint a class each frame.
      style={{
        "--glow-ring": sunMoonColor(progress, 0.45),
        "--glow-soft": sunMoonColor(progress, 0.3),
        "--glow-halo": sunMoonColor(progress, 0.4),
        "--glow-icon": sunMoonColor(progress, 0.75),
      } as CSSProperties}
      aria-label="Toggle theme"
    >
      <SunMoonIcon progress={progress} glow={false} />
    </IconButton>
  );
}
