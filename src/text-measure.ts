/**
 * Text measurement. When running in a browser it measures real rendered
 * text with a canvas 2D context (accurate, font-aware). When running in
 * Node (e.g. the stress-test script, or any server-side resolution) it
 * falls back to a character-width heuristic, so the resolver behaves
 * identically in both environments - only the precision of the estimate
 * changes, never the algorithm.
 */

const AVG_CHAR_WIDTH_RATIO = 0.56; // reasonable average for a UI sans-serif

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

export function measureTextWidth(text: string, fontSizePx: number, fontFamily = "sans-serif"): number {
  const ctx = getCanvasContext();
  if (ctx) {
    ctx.font = `${fontSizePx}px ${fontFamily}`;
    return ctx.measureText(text).width;
  }
  return text.length * fontSizePx * AVG_CHAR_WIDTH_RATIO;
}

/** Rough single-line height for a given font size (line-height ~1.25). */
export function lineHeightFor(fontSizePx: number): number {
  return fontSizePx * 1.25;
}

/**
 * Given a maximum width, estimates how many lines `text` needs at
 * `fontSizePx`. Used to decide whether a text element needs more vertical
 * room than a single line, or should be truncated instead.
 */
export function estimateLineCount(text: string, fontSizePx: number, maxWidth: number, fontFamily = "sans-serif"): number {
  const width = measureTextWidth(text, fontSizePx, fontFamily);
  return Math.max(1, Math.ceil(width / maxWidth));
}

export interface TextFit {
  fontSize: number;
  lineCount: number;
  requiredHeight: number;
}

/**
 * MODE A — "how much room does this text actually need?"
 *
 * Used BEFORE placement to turn a template's height guess into a real
 * footprint. Searches font sizes downward from `preferredFontSize` until
 * the text wraps within `maxLines` at `width`. This is what makes the
 * resolver's degradation trigger for genuine reasons (a headline that
 * truly needs 2 lines) instead of never triggering because a fixed
 * height guess happened not to overlap anything.
 */
export function fitTextRequiredHeight(
  text: string,
  width: number,
  maxLines: number,
  preferredFontSize: number,
  minFontSize = 11,
  fontFamily = "sans-serif"
): TextFit {
  for (let fontSize = preferredFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const lineCount = estimateLineCount(text, fontSize, width, fontFamily);
    if (lineCount <= maxLines) {
      return { fontSize, lineCount, requiredHeight: lineCount * lineHeightFor(fontSize) };
    }
  }
  const lineCount = Math.min(maxLines, estimateLineCount(text, minFontSize, width, fontFamily));
  return { fontSize: minFontSize, lineCount, requiredHeight: lineCount * lineHeightFor(minFontSize) };
}

/**
 * MODE B — "this box is now a fixed size (post shrink/reposition) - what's
 * the best font size that actually fits inside it?"
 *
 * Used AFTER placement, on the final rect, so the rendered font size is
 * never disconnected from the box the element actually ended up with.
 * Returns null if even `minFontSize` at `maxLines` doesn't fit the given
 * height - the caller should fall back to ellipsis truncation in that case
 * rather than overflow.
 */
export function fitTextToFixedBox(
  text: string,
  width: number,
  height: number,
  maxLines: number,
  preferredFontSize: number,
  minFontSize = 10,
  fontFamily = "sans-serif"
): TextFit | null {
  for (let fontSize = preferredFontSize; fontSize >= minFontSize; fontSize -= 1) {
    const lineCount = Math.min(maxLines, estimateLineCount(text, fontSize, width, fontFamily));
    const needed = lineCount * lineHeightFor(fontSize);
    if (needed <= height + 0.5) {
      return { fontSize, lineCount, requiredHeight: needed };
    }
  }
  return null;
}
