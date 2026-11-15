/**
 * A minimal GIF89a encoder: one global palette, looping animation, per-frame
 * delays and an optional transparent index (used for frame-to-frame deltas).
 */

export interface GifFrame {
  /** Palette indices, row-major, `width * height` entries. */
  pixels: Uint8Array;
  /** Display time in hundredths of a second. */
  delayCs: number;
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private buffer = new Uint8Array(4096);
  private length = 0;

  byte(value: number) {
    if (this.length === this.buffer.length) this.flush();
    this.buffer[this.length++] = value & 0xff;
  }

  word(value: number) {
    this.byte(value);
    this.byte(value >> 8);
  }

  bytes(values: ArrayLike<number>) {
    for (let i = 0; i < values.length; i++) this.byte(values[i]);
  }

  private flush() {
    this.chunks.push(this.buffer.slice(0, this.length));
    this.length = 0;
  }

  result() {
    this.flush();
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

/** GIF-flavoured LZW, emitted as length-prefixed sub-blocks. */
function writeLzw(out: ByteWriter, pixels: Uint8Array, minCodeSize: number) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let dictionary = new Map<number, number>();

  const block: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  const emit = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      block.push(bitBuffer & 0xff);
      if (block.length === 255) {
        out.byte(255);
        out.bytes(block);
        block.length = 0;
      }
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
  };

  emit(clearCode);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const pixel = pixels[i];
    const key = (prefix << 8) | pixel;
    const existing = dictionary.get(key);
    if (existing !== undefined) {
      prefix = existing;
      continue;
    }
    emit(prefix);
    if (nextCode < 4096) {
      dictionary.set(key, nextCode++);
      // The decoder grows one code later than the encoder assigns it.
      if (nextCode > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clearCode);
      dictionary = new Map();
      codeSize = minCodeSize + 1;
      nextCode = endCode + 1;
    }
    prefix = pixel;
  }
  emit(prefix);
  emit(endCode);
  if (bitCount > 0) block.push(bitBuffer & 0xff);
  for (let i = 0; i < block.length; i += 255) {
    const part = block.slice(i, i + 255);
    out.byte(part.length);
    out.bytes(part);
  }
  out.byte(0);
}

export function encodeGif(options: {
  width: number;
  height: number;
  /** RGB triples; padded to a power of two (at least 4 entries). */
  palette: readonly (readonly [number, number, number])[];
  frames: readonly GifFrame[];
  transparentIndex?: number;
}): Uint8Array {
  const { width, height, frames, transparentIndex } = options;
  let bits = 2;
  while (1 << bits < options.palette.length) bits++;
  if (bits > 8) throw new Error("A GIF palette holds at most 256 colours");

  const out = new ByteWriter();
  out.bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
  out.word(width);
  out.word(height);
  out.byte(0x80 | ((bits - 1) << 4) | (bits - 1)); // global table, colour resolution, size
  out.byte(0); // background index
  out.byte(0); // pixel aspect
  for (let i = 0; i < 1 << bits; i++) {
    const [r, g, b] = options.palette[i] ?? [0, 0, 0];
    out.bytes([r, g, b]);
  }

  // NETSCAPE2.0: loop forever.
  out.bytes([0x21, 0xff, 0x0b]);
  out.bytes(Array.from("NETSCAPE2.0", (c) => c.charCodeAt(0)));
  out.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);

  for (const frame of frames) {
    if (frame.pixels.length !== width * height) throw new Error("Frame size does not match the image");
    // Graphic control: disposal 1 (keep), so transparent pixels show the previous frame.
    out.bytes([0x21, 0xf9, 0x04]);
    out.byte((1 << 2) | (transparentIndex === undefined ? 0 : 1));
    out.word(frame.delayCs);
    out.byte(transparentIndex ?? 0);
    out.byte(0);

    out.byte(0x2c);
    out.word(0);
    out.word(0);
    out.word(width);
    out.word(height);
    out.byte(0); // no local table, not interlaced
    out.byte(bits);
    writeLzw(out, frame.pixels, bits);
  }
  out.byte(0x3b);
  return out.result();
}
