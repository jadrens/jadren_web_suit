/**
 * Turn an imposition plan into PDF bytes, entirely in the browser.
 *
 * Port of `pdf_tool/src/pdf_tool/render.py` using pdf-lib instead of
 * pypdf + reportlab. `pdf-lib` and `fflate` are loaded on demand so the tool's
 * initial route bundle stays small.
 */

import type { PDFDocument, PDFEmbeddedPage, PDFPage, PDFFont } from "pdf-lib";
import {
  ImpositionError,
  plan,
  type Options,
  type Slot,
  type Volume,
} from "./imposition";

type PdfLib = typeof import("pdf-lib");

let pdfLibPromise: Promise<PdfLib> | undefined;
function loadPdfLib(): Promise<PdfLib> {
  if (!pdfLibPromise) pdfLibPromise = import("pdf-lib");
  return pdfLibPromise;
}

const A4_DIAGONAL = 1008.0;
/** Below this relative size difference a page is placed 1:1 instead of scaled. */
const SCALE_TOLERANCE = 0.01;
const BLANK_LABEL = "(blank page)";

type Matrix = [number, number, number, number, number, number];
type BoundingBox = { left: number; bottom: number; right: number; top: number };
type Rotation = 0 | 90 | 180 | 270;

interface PageInfo {
  box: BoundingBox;
  matrix: Matrix;
  /** Effective (rotation-applied) dimensions. */
  w: number;
  h: number;
}

export interface ImposedFile {
  name: string;
  bytes: Uint8Array;
}

export interface ImposeResult {
  name: string;
  bytes: Uint8Array;
  mediaType: "application/pdf" | "application/zip";
}

function normalizeRotation(angle: number): Rotation {
  return (((Math.round(angle / 90) * 90) % 360) + 360) % 360 as Rotation;
}

/**
 * Form-XObject matrix mapping the original page coordinate system into the
 * final `[0, w] x [0, h]` box, with the page's clockwise /Rotate baked in
 * (equivalent to pypdf's `transfer_rotation_to_content`).
 */
function rotationMatrix(rotation: Rotation, x: number, y: number, w: number, h: number): Matrix {
  switch (rotation) {
    case 90:
      return [0, -1, 1, 0, -y, w + x];
    case 180:
      return [-1, 0, 0, -1, w + x, h + y];
    case 270:
      return [0, 1, -1, 0, h + y, -x];
    default:
      return [1, 0, 0, 1, -x, -y];
  }
}

function describePage(page: PDFPage): PageInfo {
  const crop = page.getCropBox();
  const rotation = normalizeRotation(page.getRotation().angle);
  const swapped = rotation === 90 || rotation === 270;
  return {
    box: {
      left: crop.x,
      bottom: crop.y,
      right: crop.x + crop.width,
      top: crop.y + crop.height,
    },
    matrix: rotationMatrix(rotation, crop.x, crop.y, crop.width, crop.height),
    w: swapped ? crop.height : crop.width,
    h: swapped ? crop.width : crop.height,
  };
}

/** Load a source document, surfacing user-facing error codes. */
async function loadSourceDoc(bytes: Uint8Array): Promise<PDFDocument> {
  const { PDFDocument, PDFName } = await loadPdfLib();
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    // pdf-lib cannot decrypt. If it loads with `ignoreEncryption`, the file is
    // simply password-protected; otherwise it is not a readable PDF.
    try {
      await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    } catch {
      throw new ImpositionError("invalidPdf");
    }
    throw new ImpositionError("encrypted");
  }

  // pdf-lib refuses to embed a page with no /Contents stream. Blank pages in
  // otherwise valid PDFs often omit it, so give them an empty stream; they can
  // then be imposed and still receive their page-number stamp.
  for (const page of doc.getPages()) {
    if (!page.node.Contents()) {
      page.node.set(PDFName.of("Contents"), doc.context.obj([]));
    }
  }
  return doc;
}

/** Read only the page count of a PDF (used for the live preview and validation). */
export async function inspectPdf(bytes: Uint8Array): Promise<number> {
  const doc = await loadSourceDoc(bytes);
  const count = doc.getPageCount();
  if (count <= 0) throw new ImpositionError("emptyPdf");
  return count;
}

function outputName(sourceName: string, options: Options, volume: Volume, volumeCount: number): string {
  const stem = sourceName.replace(/\.[^/.]+$/, "") || "document";
  let name = `${stem}_${options.layout}`;
  if (volumeCount > 1) {
    name += `_${String(volume.index).padStart(2, "0")}_p${volume.first}-${volume.last}`;
  }
  return `${name}.pdf`;
}

interface SourcePage {
  embedded: PDFEmbeddedPage;
  w: number;
  h: number;
}

async function renderVolume(
  srcDoc: PDFDocument,
  volume: Volume,
  options: Options,
  totalPages: number,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const outDoc = await PDFDocument.create();
  const font: PDFFont = await outDoc.embedFont(StandardFonts.Helvetica);

  const srcPages = srcDoc.getPages();

  // Only embed pages actually referenced by this volume, to keep memory bounded
  // for large documents split into several volumes.
  const needed = [...new Set(volume.sides.flat().filter((p): p is number => p !== null))].sort((a, b) => a - b);
  const infos = needed.map((n) => describePage(srcPages[n - 1]));
  const embedded = await outDoc.embedPages(
    needed.map((n) => srcPages[n - 1]),
    infos.map((i) => i.box),
    infos.map((i) => i.matrix),
  );
  const source = new Map<number, SourcePage>();
  needed.forEach((n, i) => source.set(n, { embedded: embedded[i], w: infos[i].w, h: infos[i].h }));

  // Matches Python: the first real page of the volume provides the default cell
  // size, used only when both slots of a side are blank.
  let firstReal: number | null = null;
  for (const [l, r] of volume.sides) {
    if (l !== null) { firstReal = l; break; }
    if (r !== null) { firstReal = r; break; }
  }
  const fallback = firstReal !== null ? source.get(firstReal) : undefined;

  const count = volume.sides.length;
  for (let i = 0; i < count; i++) {
    const n = i + 1;
    const [left, right] = volume.sides[i];
    const ref = left ?? right;
    const dim = (ref !== null ? source.get(ref) : fallback) ?? fallback;
    if (!dim) throw new ImpositionError("emptyPdf");
    const cw = dim.w;
    const ch = dim.h;
    const sheet = outDoc.addPage([cw * 2, ch]);

    const slots: [Slot, number][] = [[left, 0], [right, cw]];
    for (const [slot, cellX] of slots) {
      if (slot === null) continue;
      const sp = source.get(slot);
      if (!sp) continue;

      let scale = Math.min(cw / sp.w, ch / sp.h);
      if (Math.abs(scale - 1) < SCALE_TOLERANCE) scale = 1;
      const offX = (cw - sp.w * scale) / 2;
      const offY = (ch - sp.h * scale) / 2;
      sheet.drawPage(sp.embedded, { x: cellX + offX, y: offY, xScale: scale, yScale: scale });

      if (options.pageNumbers) {
        // Translucent "n / total" in the bottom-right, scaled to the page size.
        const sizeFactor = Math.hypot(sp.w, sp.h) / A4_DIAGONAL;
        const baseSize = Math.min(Math.max(12 * 0.9 * sizeFactor, 8), 48);
        const fontSize = baseSize * scale;
        const text = `${slot} / ${totalPages}`;
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        sheet.drawText(text, {
          x: cellX + offX + sp.w * scale - 20 * sizeFactor * scale - textWidth,
          y: offY + 15 * sizeFactor * scale,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          opacity: 0.5,
        });
      }
    }

    if (options.sheetLabels) {
      sheet.drawText(`${n}/${count}`, {
        x: 10,
        y: ch - 20,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      for (const [slot, cellX] of slots) {
        if (slot !== null) continue;
        const size = 12;
        const textWidth = font.widthOfTextAtSize(BLANK_LABEL, size);
        sheet.drawText(BLANK_LABEL, {
          x: cellX + (cw - textWidth) / 2,
          y: ch / 2 - size * 0.35,
          size,
          font,
          color: rgb(0, 0, 0),
          opacity: 0.35,
        });
      }
    }
  }

  return outDoc.save();
}

/** Impose one PDF; returns one `(filename, bytes)` entry per volume. */
export async function imposePdf(bytes: Uint8Array, sourceName: string, options: Options): Promise<ImposedFile[]> {
  const srcDoc = await loadSourceDoc(bytes);
  const pageCount = srcDoc.getPageCount();
  const volumes = plan(pageCount, options);
  const outputs: ImposedFile[] = [];
  for (const volume of volumes) {
    outputs.push({
      name: outputName(sourceName, options, volume, volumes.length),
      bytes: await renderVolume(srcDoc, volume, options, pageCount),
    });
  }
  return outputs;
}

/** Impose every input file and return a single PDF, or a ZIP of several. */
export async function imposeAll(
  files: { name: string; bytes: Uint8Array }[],
  options: Options,
): Promise<ImposeResult> {
  const outputs: ImposedFile[] = [];
  for (const file of files) {
    outputs.push(...(await imposePdf(file.bytes, file.name, options)));
  }

  if (outputs.length === 1) {
    return { name: outputs[0].name, bytes: outputs[0].bytes, mediaType: "application/pdf" };
  }

  const { zipSync } = await import("fflate");
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const output of outputs) {
    let name = output.name;
    if (used.has(name)) {
      // ZIP allows duplicate names, but an object keyed by name does not.
      const stem = name.replace(/\.pdf$/, "");
      let n = 2;
      while (used.has(`${stem}_${n}.pdf`)) n++;
      name = `${stem}_${n}.pdf`;
    }
    used.add(name);
    entries[name] = output.bytes;
  }

  const stem = files.length === 1 ? files[0].name.replace(/\.[^/.]+$/, "") : "";
  return {
    name: `${stem || "imposed"}_${options.layout}.zip`,
    bytes: zipSync(entries),
    mediaType: "application/zip",
  };
}

/** Trigger a browser download for the imposed result. */
export function downloadResult(result: ImposeResult): void {
  const blob = new Blob([result.bytes as BlobPart], { type: result.mediaType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
