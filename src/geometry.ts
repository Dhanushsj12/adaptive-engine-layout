export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rectWithinBounds(r: Rect, bounds: Rect): boolean {
  return (
    r.x >= bounds.x - 0.01 &&
    r.y >= bounds.y - 0.01 &&
    r.x + r.width <= bounds.x + bounds.width + 0.01 &&
    r.y + r.height <= bounds.y + bounds.height + 0.01
  );
}

export function clipToBounds(r: Rect, bounds: Rect): Rect {
  const width = Math.min(r.width, bounds.width);
  const height = Math.min(r.height, bounds.height);
  const x = Math.min(Math.max(r.x, bounds.x), bounds.x + bounds.width - width);
  const y = Math.min(Math.max(r.y, bounds.y), bounds.y + bounds.height - height);
  return { x, y, width, height };
}

/**
 * Finds the largest free axis-aligned rectangle inside `bounds` that
 * doesn't overlap any rect in `occupied`, using a coarse grid scan. This
 * is the resolver's "reposition" fallback: when an element can't fit its
 * ideal region even at minimum size, this looks for *any* leftover space
 * on the surface before giving up and dropping it.
 *
 * Grid resolution is fixed at 40x40 cells regardless of surface size, so
 * this stays fast and deterministic for any input dimensions.
 */
export function findLargestFreeRect(bounds: Rect, occupied: readonly Rect[]): Rect | null {
  const GRID = 40;
  const cellW = bounds.width / GRID;
  const cellH = bounds.height / GRID;
  if (cellW <= 0 || cellH <= 0) return null;

  const free: boolean[][] = Array.from({ length: GRID }, (_, row) =>
    Array.from({ length: GRID }, (_, col) => {
      const cellRect: Rect = {
        x: bounds.x + col * cellW,
        y: bounds.y + row * cellH,
        width: cellW,
        height: cellH,
      };
      return !occupied.some((o) => rectsOverlap(cellRect, o));
    })
  );

  const isFree = (row: number, col: number): boolean => free[row]?.[col] ?? false;

  let best: Rect | null = null;
  let bestArea = 0;

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (!isFree(row, col)) continue;

      // Grow width along the row while cells stay free.
      let maxCols = 0;
      for (let c = col; c < GRID && isFree(row, c); c++) maxCols = c - col + 1;

      // For each possible width, grow height while the full row stays free.
      for (let w = 1; w <= maxCols; w++) {
        let h = 0;
        for (let r = row; r < GRID; r++) {
          let rowOk = true;
          for (let c = col; c < col + w; c++) {
            if (!isFree(r, c)) {
              rowOk = false;
              break;
            }
          }
          if (!rowOk) break;
          h = r - row + 1;
        }
        const area = w * cellW * h * cellH;
        if (area > bestArea) {
          bestArea = area;
          best = { x: bounds.x + col * cellW, y: bounds.y + row * cellH, width: w * cellW, height: h * cellH };
        }
      }
    }
  }

  return best;
}
