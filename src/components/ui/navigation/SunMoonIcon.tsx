"use client";

import { useId } from "react";

const SUN_RGB = [0xfb, 0xbf, 0x24];
const MOON_RGB = [0x63, 0x66, 0xf1];
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Maps the overall progress onto one phase's [start, end] window, eased. */
const phase = (p: number, start: number, end: number) => easeInOut(clamp01((p - start) / (end - start)));
const mix = (from: number, to: number, t: number) => from + (to - from) * t;

/** The sun ↔ moon tint at `progress` (0–100), for glows drawn around the icon. */
export function sunMoonColor(progress: number, alpha = 1) {
  const t = phase(clamp01(progress / 100), 0, 1);
  const [r, g, b] = SUN_RGB.map((c, i) => Math.round(mix(c, MOON_RGB[i], t)));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface SunMoonIconProps {
  /** 0 = complete sun, 100 = complete moon. Any value in between renders that frame of the morph. */
  progress: number;
  size?: number;
  /** Soft light around the shape, tinted with the current sun/moon color. */
  glow?: boolean;
}

// Stateless: every frame is derived from `progress`, so whoever drives it can stop or reverse at any point.
// Sun → moon: the rays retract first, the disc grows while a masking circle slides in to carve the
// crescent, and a star twinkles into the crescent's hollow at the end.
export default function SunMoonIcon({ progress, size = 22, glow = true }: SunMoonIconProps) {
  const maskId = `sun-moon-mask-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const p = clamp01(progress / 100);

  const rays = phase(p, 0, 0.45);
  const crescent = phase(p, 0.25, 1);
  const star = phase(p, 0.7, 1);
  const offset = mix(10, 0, crescent);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      style={{
        color: sunMoonColor(progress),
        overflow: "visible",
        filter: glow ? `drop-shadow(0 0 3px ${sunMoonColor(progress, 0.75)})` : undefined,
      }}
    >
      <mask id={maskId}>
        <rect x="-4" y="-4" width="32" height="32" fill="white" />
        <circle cx={17 + offset} cy={6.5 - offset} r="7.5" fill="black" />
      </mask>
      <g transform={`rotate(${mix(90, -30, easeInOut(p))} 12 12)`}>
        <circle cx="12" cy="12" r={mix(4.95, 9, crescent)} fill="currentColor" mask={`url(#${maskId})`} />
        <g
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={1 - rays}
          transform={`rotate(${-45 * rays} 12 12) translate(12 12) scale(${1 - 0.6 * rays}) translate(-12 -12)`}
        >
          {RAY_ANGLES.map((angle) => (
            <line key={angle} x1="12" y1="2" x2="12" y2="4.2" transform={`rotate(${angle} 12 12)`} />
          ))}
        </g>
      </g>
      {/* Four-point star in the crescent's hollow (kept outside the rotating group so it stays upright). */}
      <path
        d="M0 -2.4 Q0.35 -0.35 2.4 0 Q0.35 0.35 0 2.4 Q-0.35 0.35 -2.4 0 Q-0.35 -0.35 0 -2.4 Z"
        fill="currentColor"
        opacity={star}
        transform={`translate(16.6 6.4) rotate(${mix(-90, 0, star)}) scale(${star})`}
      />
    </svg>
  );
}
