/**
 * Text measurement. When running in a browser it measures real rendered
 * text with a canvas 2D context (accurate, font-aware). When running in
 * Node (e.g. the stress-test script, or any server-side resolution) it
 * falls back to a character-width heuristic, so the resolver behaves
 * identically in both environments - only the precision of the estimate
 * changes, never the algorithm.
 */

const AVG_CHAR_WIDTH_RATIO = 0.56; // reasonable average for a UI sans-serif

/**
 * Account for the 8px left + 8px right padding applied in render-dom.ts
 * so measurements evaluate against the actual available content width.
 */
const TEXT_BOX_PADDING_X = 16;

/**
 * The ONE font stack used for both measurement and rendering. Keeping
 * this as a single exported constant, imported by both this file and
 * render-dom.ts, is what stops measurement and rendering from silently
 * drifting onto two different fonts (a real bug this project hit twice).
 */
export const RENDER_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Small safety margin on every raw measurement, absorbing residual
 * sub-pixel/kerning differences so a borderline case errs toward
 * "needs more room" instead of "just barely fits, then doesn't." */
const MEASUREMENT_SAFETY_MARGIN = 1.08;

let sharedCanvasContext: CanvasRenderingContext2D | null | undefined;

function getCanvasContext(): CanvasRenderingContext2D | null {
  if (sharedCanvasContext !== undefined) return sharedCanvasContext;
  if (typeof document === "undefined") {
    sharedCanvasContext = null;
    return null;
  }
  const canvas = document.createElement("canvas");
  sharedCanvasContext = canvas.getContext("2d");
  return sharedCanvasContext;
}

function rawMeasure(text: string, fontSizePx: number, fontFamily: string): number {
  const ctx = getCanvasContext();
  if (ctx) {
    ctx.font = `${fontSizePx}px ${fontFamily}`;
    return ctx.measureText(text).width;
  }
  return text.length * fontSizePx * AVG_CHAR_WIDTH_RATIO;
}

export function measureTextWidth(text: string, fontSizePx: number, fontFamily = RENDER_FONT_FAMILY): number {
  return rawMeasure(text, fontSizePx, fontFamily) * MEASUREMENT_SAFETY_MARGIN;
}

/** Rough single-line height for a given font size (line-height ~1.25). */
export function lineHeightFor(fontSizePx: number): number {
  return fontSizePx * 1.25;
}

interface WordWrapResult {
  lineCount: number;
  longestWordWidth: number;
}

/**
 * Simulates real (space-based) word wrapping, the same way a browser
 * actually flows text - not a naive `totalWidth / boxWidth` division.
 *
 * The naive division caused a real bug: it can conclude "this fits in 2
 * lines" at a font size where a single word ("NovaBuds") is itself
 * wider than the box, which a browser can only satisfy by breaking that
 * word apart mid-letter. Simulating greedy word wrap catches that case
 * directly via `longestWordWidth`.
 */
function simulateWordWrap(text: string, fontSizePx: number, maxWidth: number, fontFamily: string): WordWrapResult {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lineCount: 1, longestWordWidth: 0 };

  const spaceWidth = measureTextWidth(" ", fontSizePx, fontFamily);
  let lines = 1;
  let currentLineWidth = 0;
  let longestWordWidth = 0;

  for (const word of words) {
    const wordWidth = measureTextWidth(word, fontSizePx, fontFamily);
    longestWordWidth = Math.max(longestWordWidth, wordWidth);

    const widthIfAppended = currentLineWidth === 0 ? wordWidth : currentLineWidth + spaceWidth + wordWidth;

    if (widthIfAppended > maxWidth && currentLineWidth > 0) {
      lines += 1;
      currentLineWidth = wordWidth;
    } else {
      currentLineWidth = widthIfAppended;
    }
  }

  return { lineCount: lines, longestWordWidth };
}

export function estimateLineCount(text: string, fontSizePx: number, maxWidth: number, fontFamily = RENDER_FONT_FAMILY): number {
  return simulateWordWrap(text, fontSizePx, maxWidth, fontFamily).lineCount;
}

function longestWordOverflows(text: string, fontSizePx: number, maxWidth: number, fontFamily: string): boolean {
  return simulateWordWrap(text, fontSizePx, maxWidth, fontFamily).longestWordWidth > maxWidth;
}

export interface TextFit {
  fontSize: number;
  lineCount: number;
  requiredHeight: number;
}

/**
 * MODE A — "how much room does this text actually need?"
 *
 * Now rejects any font size where the single longest word wouldn't fit
 * the given width - that's the check that stops the resolver from ever
 * choosing a font size that would force a mid-word break.
 */
export function fitTextRequiredHeight(
  text: string,
  width: number,
  maxLines: number,
  preferredFontSize: number,
  minFontSize = 11,
  fontFamily = RENDER_FONT_FAMILY
): TextFit {
  const contentWidth = Math.max(1, width - TEXT_BOX_PADDING_X);

  for (let fontSize = preferredFontSize; fontSize >= minFontSize; fontSize -= 1) {
    if (longestWordOverflows(text, fontSize, contentWidth, fontFamily)) continue;
    const lineCount = estimateLineCount(text, fontSize, contentWidth, fontFamily);
    if (lineCount <= maxLines) {
      return { fontSize, lineCount, requiredHeight: lineCount * lineHeightFor(fontSize) };
    }
  }
  const lineCount = Math.min(maxLines, estimateLineCount(text, minFontSize, contentWidth, fontFamily));
  return { fontSize: minFontSize, lineCount, requiredHeight: lineCount * lineHeightFor(minFontSize) };
}

/**
 * MODE B — same word-safety check, applied to the final fixed box after
 * placement/shrinking.
 */
export function fitTextToFixedBox(
  text: string,
  width: number,
  height: number,
  maxLines: number,
  preferredFontSize: number,
  minFontSize = 10,
  fontFamily = RENDER_FONT_FAMILY
): TextFit | null {
  const contentWidth = Math.max(1, width - TEXT_BOX_PADDING_X);

  for (let fontSize = preferredFontSize; fontSize >= minFontSize; fontSize -= 1) {
    if (longestWordOverflows(text, fontSize, contentWidth, fontFamily)) continue;
    const lineCount = Math.min(maxLines, estimateLineCount(text, fontSize, contentWidth, fontFamily));
    const needed = lineCount * lineHeightFor(fontSize);
    if (needed <= height + 0.5) {
      return { fontSize, lineCount, requiredHeight: needed };
    }
  }
  return null;
}