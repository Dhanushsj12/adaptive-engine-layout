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
