import { randomBytes, randomInt } from "node:crypto";
import { encodeGif, type GifFrame } from "./gif";

/**
 * Animated GIF challenge. Defences, in order of what they defeat:
 *  - Characters appear one at a time in their own slot, each for a random
 *    period with noise-only gaps, so no single frame holds the answer (plain OCR).
 *  - Every frame re-randomises part of the background noise and drops random
 *    stroke pixels, using the same colours for both, so frame differencing
 *    does not isolate the strokes.
 *  - Each character is drawn from a stroke font with its own rotation, scale,
 *    shear and a sine warp, so templates do not match.
 * A human sees a flickering character settle in each slot, left to right.
 */

/** No look-alikes: 0/O/D/Q, 1/I/L, 2/Z, 5/S, 8/B, 6/G, U/V. */
export const CAPTCHA_ALPHABET = "ACEFHJKMNPRTWXY3479";

type Stroke = readonly (readonly [number, number])[];

// Polylines on a 0..1 box, y pointing down.
const GLYPHS: Record<string, readonly Stroke[]> = {
  A: [[[0.05, 1], [0.5, 0], [0.95, 1]], [[0.25, 0.6], [0.75, 0.6]]],
  C: [[[0.92, 0.15], [0.7, 0.02], [0.35, 0.02], [0.1, 0.25], [0.05, 0.5], [0.1, 0.75], [0.35, 0.98], [0.7, 0.98], [0.92, 0.85]]],
  E: [[[0.9, 0], [0.1, 0], [0.1, 1], [0.9, 1]], [[0.1, 0.5], [0.7, 0.5]]],
  F: [[[0.9, 0], [0.1, 0], [0.1, 1]], [[0.1, 0.5], [0.7, 0.5]]],
  H: [[[0.1, 0], [0.1, 1]], [[0.9, 0], [0.9, 1]], [[0.1, 0.5], [0.9, 0.5]]],
  J: [[[0.3, 0], [0.85, 0]], [[0.65, 0], [0.65, 0.8], [0.5, 0.98], [0.25, 0.98], [0.1, 0.8]]],
  K: [[[0.1, 0], [0.1, 1]], [[0.9, 0], [0.1, 0.6]], [[0.35, 0.42], [0.9, 1]]],
  M: [[[0.05, 1], [0.12, 0], [0.5, 0.65], [0.88, 0], [0.95, 1]]],
  N: [[[0.1, 1], [0.1, 0], [0.9, 1], [0.9, 0]]],
  P: [[[0.1, 1], [0.1, 0], [0.7, 0], [0.9, 0.15], [0.9, 0.38], [0.7, 0.52], [0.1, 0.52]]],
  R: [[[0.1, 1], [0.1, 0], [0.7, 0], [0.9, 0.15], [0.9, 0.38], [0.7, 0.52], [0.1, 0.52]], [[0.5, 0.52], [0.92, 1]]],
  T: [[[0.05, 0], [0.95, 0]], [[0.5, 0], [0.5, 1]]],
  W: [[[0.02, 0], [0.25, 1], [0.5, 0.35], [0.75, 1], [0.98, 0]]],
  X: [[[0.1, 0], [0.9, 1]], [[0.9, 0], [0.1, 1]]],
  Y: [[[0.05, 0], [0.5, 0.5], [0.95, 0]], [[0.5, 0.5], [0.5, 1]]],
  "3": [[[0.1, 0.1], [0.35, 0], [0.7, 0], [0.88, 0.15], [0.88, 0.35], [0.65, 0.48], [0.35, 0.48]], [[0.65, 0.48], [0.92, 0.62], [0.92, 0.85], [0.7, 1], [0.3, 1], [0.08, 0.88]]],
  "4": [[[0.7, 1], [0.7, 0], [0.05, 0.7], [0.95, 0.7]]],
  "7": [[[0, 0], [1, 0], [0.3, 1]]],
  "9": [[[0.9, 0.45], [0.65, 0.58], [0.3, 0.58], [0.08, 0.4], [0.08, 0.18], [0.3, 0], [0.65, 0], [0.9, 0.18], [0.9, 0.6], [0.75, 0.9], [0.45, 1], [0.15, 0.92]]],
};

export const CAPTCHA_WIDTH = 200;
export const CAPTCHA_HEIGHT = 72;

const PAPER = 0;
const DUST = 1;
const ASH = 2;
const INK = 3;
const TRANSPARENT = 4;
const PALETTE = [
  [244, 240, 232],
  [176, 168, 156],
  [112, 104, 96],
  [34, 30, 28],
  [255, 0, 255],
] as const;

const FRAME_CS = 8; // 80 ms per frame
// Noise needs millions of draws, so read them from a pooled CSPRNG buffer.
let pool = new Uint32Array(0);
let poolIndex = 0;
function random() {
  if (poolIndex >= pool.length) {
    pool = new Uint32Array(randomBytes(256 * 1024).buffer);
    poolIndex = 0;
  }
  return pool[poolIndex++] / 2 ** 32;
}
const between = (min: number, max: number) => min + random() * (max - min);

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Rasterises one distorted character centred in its slot; returns covered pixel indices. */
function glyphMask(char: string, slotCenterX: number, slotWidth: number) {
  const strokes = GLYPHS[char];
  if (!strokes) throw new Error(`No glyph for ${char}`);
  const glyphHeight = between(0.55, 0.72) * CAPTCHA_HEIGHT;
  const wide = char === "M" || char === "W";
  const glyphWidth = Math.min(slotWidth * (wide ? 1.05 : 0.95), glyphHeight * (wide ? between(0.95, 1.1) : between(0.6, 0.85)));
  const angle = between(-0.45, 0.45);
  const shear = between(-0.35, 0.35);
  const cx = slotCenterX + between(-slotWidth * 0.12, slotWidth * 0.12);
  const cy = CAPTCHA_HEIGHT / 2 + between(-6, 6);
  const waveAmp = between(1.5, 3.5);
  const waveFreq = between(0.15, 0.3);
  const wavePhase = between(0, Math.PI * 2);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const segments: [number, number, number, number][] = [];
  for (const stroke of strokes) {
    const points = stroke.map(([x, y]) => {
      const lx = (x - 0.5) * glyphWidth + (y - 0.5) * glyphHeight * shear;
      const ly = (y - 0.5) * glyphHeight;
      return [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos] as const;
    });
    for (let i = 1; i < points.length; i++) {
      segments.push([points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]]);
    }
  }

  const half = between(1.6, 2.3);
  const reach = glyphHeight + 8;
  const covered: number[] = [];
  for (let y = Math.max(0, Math.floor(cy - reach)); y < Math.min(CAPTCHA_HEIGHT, Math.ceil(cy + reach)); y++) {
    for (let x = Math.max(0, Math.floor(cx - reach)); x < Math.min(CAPTCHA_WIDTH, Math.ceil(cx + reach)); x++) {
      // Sample the undistorted shape at a sine-displaced position.
      const sx = x + waveAmp * Math.sin(y * waveFreq + wavePhase);
      const sy = y + waveAmp * Math.cos(x * waveFreq + wavePhase);
      if (segments.some(([ax, ay, bx, by]) => distanceToSegment(sx, sy, ax, ay, bx, by) <= half)) {
        covered.push(y * CAPTCHA_WIDTH + x);
      }
    }
  }
  return covered;
}

function noiseColour() {
  const roll = random();
  return roll < 0.55 ? PAPER : roll < 0.8 ? DUST : roll < 0.95 ? ASH : INK;
}

export function randomCaptchaText(length: number) {
  return Array.from({ length }, () => CAPTCHA_ALPHABET[randomInt(0, CAPTCHA_ALPHABET.length)]).join("");
}

/** Renders `text` as a looping GIF. */
export function renderCaptchaGif(text: string): Uint8Array {
  const slotWidth = CAPTCHA_WIDTH / text.length;
  const masks = Array.from(text, (char, index) => glyphMask(char, slotWidth * (index + 0.5), slotWidth));

  // Timeline: [gap, show] per character, in frames.
  const schedule: { start: number; end: number }[] = [];
  let cursor = randomInt(2, 5);
  for (let i = 0; i < masks.length; i++) {
    const length = randomInt(9, 15); // 0.72-1.2 s
    schedule.push({ start: cursor, end: cursor + length });
    cursor += length + randomInt(2, 6);
  }
  const frameCount = cursor;

  const size = CAPTCHA_WIDTH * CAPTCHA_HEIGHT;
  const current = new Uint8Array(size);
  for (let i = 0; i < size; i++) current[i] = noiseColour();
  const frames: GifFrame[] = [{ pixels: current.slice(), delayCs: FRAME_CS }];

  for (let frame = 1; frame < frameCount; frame++) {
    const next = current.slice();
    // Churn a random share of the background every frame.
    const churn = between(0.12, 0.2);
    for (let i = 0; i < size; i++) if (random() < churn) next[i] = noiseColour();

    schedule.forEach(({ start, end }, index) => {
      // When a character's window closes its strokes vanish at once, so it
      // never lingers into the next character's window.
      if (frame === end) {
        for (const pixel of masks[index]) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const target = pixel + dx + dy * CAPTCHA_WIDTH;
              if (target >= 0 && target < size) next[target] = noiseColour();
            }
          }
        }
      }
      if (frame < start || frame >= end) return;
      // A small per-frame wobble makes the strokes move against the noise.
      const offset = randomInt(-1, 2) + randomInt(-1, 2) * CAPTCHA_WIDTH;
      for (const pixel of masks[index]) {
        const target = pixel + offset;
        if (target < 0 || target >= size) continue;
        const roll = random();
        next[target] = roll < 0.72 ? INK : roll < 0.85 ? ASH : roll < 0.93 ? DUST : PAPER;
      }
    });

    // Encode only what changed; the GIF keeps the rest from the previous frame.
    const delta = new Uint8Array(size);
    for (let i = 0; i < size; i++) delta[i] = next[i] === current[i] ? TRANSPARENT : next[i];
    current.set(next);
    frames.push({ pixels: delta, delayCs: FRAME_CS });
  }

  return encodeGif({
    width: CAPTCHA_WIDTH,
    height: CAPTCHA_HEIGHT,
    palette: PALETTE,
    frames,
    transparentIndex: TRANSPARENT,
  });
}
