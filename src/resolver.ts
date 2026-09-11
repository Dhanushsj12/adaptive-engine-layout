import { templateFor } from "./composition-strategies";
import { clipToBounds, findLargestFreeRect, rectsOverlap, rectWithinBounds, type Rect } from "./geometry";
import { fitTextRequiredHeight, fitTextToFixedBox, measureTextWidth } from "./text-measure";
import type { AdElement, AdSpec, DegradationAction, ElementRole, ResolvedElement, ResolvedLayout, SurfaceProfile } from "./types";

const SHRINK_STEPS = [1, 0.85, 0.7, 0.55, 0.4]; // fraction of ideal size tried, in order

/** How many lines each role's text is allowed to wrap onto before it must
 * shrink further or truncate. A CTA button and a price should read as one
 * line; a headline may reasonably wrap to two. */
const MAX_LINES_BY_ROLE: Partial<Record<ElementRole, number>> = {
  primary: 2,
  secondary: 1,
  action: 1,
  branding: 1,
};

function getContentBox(surface: SurfaceProfile): Rect {
  const sa = surface.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    x: sa.left,
    y: sa.top,
    width: surface.width - sa.left - sa.right,
    height: surface.height - sa.top - sa.bottom,
  };
}

/**
 * The absolute floor an element may never shrink below, combining the
 * spec's own minWidth/minHeight with hard surface constraints (tap
 * targets, minimum legible text size at viewing distance, and - for text
 * - the real height its content needs at the smallest readable font).
 */
function hardFloor(el: AdElement, surface: SurfaceProfile, idealWidth: number): { minWidth: number; minHeight: number } {
  let minWidth = el.minWidth ?? 24;
  let minHeight = el.minHeight ?? 16;

  if (el.type === "button" && surface.touchOnly && surface.minTapTarget) {
    minWidth = Math.max(minWidth, surface.minTapTarget);
    minHeight = Math.max(minHeight, surface.minTapTarget);
  }

  if ((el.type === "text" || el.type === "button") && el.content) {
    const minFontSize = surface.minTextSize ?? 11;
    const maxLines = MAX_LINES_BY_ROLE[el.role] ?? 1;
    // Use the content's ACTUAL required line count at the minimum
    // readable size - not a pessimistic "assume worst case" floor. A
    // headline that fits on 1 line at the minimum size shouldn't be
    // floored as if it needed the full maxLines allowance.
    const fit = fitTextRequiredHeight(el.content, idealWidth, maxLines, minFontSize, minFontSize);
    minHeight = Math.max(minHeight, fit.requiredHeight);
    if (surface.viewingDistance === "far") {
      const naturalWidth = measureTextWidth(el.content, minFontSize);
      minWidth = Math.max(minWidth, Math.min(naturalWidth, surface.width));
    }
  }

  return { minWidth, minHeight };
}

function idealRectFor(el: AdElement, contentBox: Rect, template: ReturnType<typeof templateFor>["template"]): Rect {
  const frac = template[el.role];
  return {
    x: contentBox.x + frac.x * contentBox.width,
    y: contentBox.y + frac.y * contentBox.height,
    width: frac.w * contentBox.width,
    height: frac.h * contentBox.height,
  };
}

/**
 * Grows (never shrinks) a template's height guess to whatever the text
 * actually needs at a readable size - this is the fix for the bug where a
 * box was sized purely from a height guess with no connection to whether
 * the content fits: "Summer Sale - 40% Off Everything" wrapping to 2
 * lines at a 32px font needs ~90px, not the 53px a 1-line guess allotted.
 * That mismatch is exactly what let text visually overrun into the next
 * element. Making this footprint honest before placement is what lets
 * the shrink/reposition/drop cascade trigger for real reasons.
 */
function contentAwareIdealRect(el: AdElement, ideal: Rect, surface: SurfaceProfile): { rect: Rect; preferredFontSize: number } {
  if ((el.type !== "text" && el.type !== "button") || !el.content) {
    return { rect: ideal, preferredFontSize: 0 };
  }
  const maxLines = MAX_LINES_BY_ROLE[el.role] ?? 1;
  const preferredFontSize = Math.min(64, Math.max(surface.minTextSize ?? 12, Math.round(ideal.height * 0.55)));
  const fit = fitTextRequiredHeight(el.content, ideal.width, maxLines, preferredFontSize, surface.minTextSize ?? 11);
  const requiredHeight = fit.requiredHeight + 6; // small vertical padding
  return {
    rect: { ...ideal, height: Math.max(ideal.height, requiredHeight) },
    preferredFontSize: fit.fontSize,
  };
}

function shrinkTowardFloor(ideal: Rect, floor: { minWidth: number; minHeight: number }, scale: number): Rect {
  const width = Math.max(floor.minWidth, ideal.width * scale);
  const height = Math.max(floor.minHeight, ideal.height * scale);
  return { x: ideal.x, y: ideal.y, width, height };
}

/** Picks the font size that actually fits the FINAL box the element ended
 * up with, after all shrinking/repositioning is done - so what's rendered
 * is never disconnected from the space the algorithm actually gave it. */
function resolveFinalTextStyle(
  el: AdElement,
  finalRect: Rect,
  surface: SurfaceProfile
): { fontSize?: number; lineClampLines?: number; truncated: boolean } {
  if ((el.type !== "text" && el.type !== "button") || !el.content) return { truncated: false };
  const maxLines = MAX_LINES_BY_ROLE[el.role] ?? 1;
  const preferredFontSize = Math.min(64, Math.max(surface.minTextSize ?? 12, Math.round(finalRect.height * 0.55)));
  const fit = fitTextToFixedBox(el.content, finalRect.width, finalRect.height, maxLines, preferredFontSize, surface.minTextSize ?? 10);
  if (fit) return { fontSize: fit.fontSize, lineClampLines: fit.lineCount, truncated: false };
  // Even the smallest readable font doesn't fit this box - truncate with
  // an ellipsis rather than silently overflowing. This is a documented
  // last resort, not the primary sizing strategy.
  return { fontSize: surface.minTextSize ?? 10, lineClampLines: maxLines, truncated: true };
}

export function resolveLayout(spec: AdSpec, surface: SurfaceProfile): ResolvedLayout {
  const contentBox = getContentBox(surface);
  const { template } = templateFor(surface, contentBox.width, contentBox.height);

  const ordered = [...spec.elements].sort((a, b) => a.priority - b.priority);
  const placed: Array<ResolvedElement & { rect: Rect }> = [];
  const warnings: string[] = [];

  for (const el of ordered) {
    const templateIdeal = idealRectFor(el, contentBox, template);
    const { rect: ideal } = contentAwareIdealRect(el, templateIdeal, surface);
    const floor = hardFloor(el, surface, ideal.width);
    const occupied = placed.map((p) => p.rect);

    let finalRect: Rect | null = null;
    let degradation: DegradationAction = "none";

    // 1) Try the content-aware ideal rect, then progressively smaller
    //    versions of it, anchored at the same top-left corner, down to
    //    its hard floor.
    for (const scale of SHRINK_STEPS) {
      const candidate = clipToBounds(shrinkTowardFloor(ideal, floor, scale), contentBox);
      if (candidate.width < floor.minWidth - 0.5 || candidate.height < floor.minHeight - 0.5) continue;
      if (!occupied.some((o) => rectsOverlap(candidate, o)) && rectWithinBounds(candidate, contentBox)) {
        finalRect = candidate;
        degradation = scale === 1 && candidate.height <= templateIdeal.height + 0.5 ? "none" : "shrunk";
        break;
      }
    }

    // 2) Nothing in its own region works - look anywhere else on the
    //    surface for free space big enough to hold it at its floor size.
    if (!finalRect) {
      const free = findLargestFreeRect(contentBox, occupied);
      if (free && free.width >= floor.minWidth && free.height >= floor.minHeight) {
        finalRect = { x: free.x, y: free.y, width: floor.minWidth, height: floor.minHeight };
        degradation = "repositioned";
      }
    }

    // 3) Still nothing - this element does not fit on this surface at all.
    if (!finalRect) {
      warnings.push(
        `"${el.id}" (priority ${el.priority}, role ${el.role}) dropped: no space left on "${surface.name}" after placing higher-priority elements.`
      );
      placed.push({
        id: el.id,
        type: el.type,
        role: el.role,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        visible: false,
        degradation: "dropped",
        rect: { x: 0, y: 0, width: 0, height: 0 },
      });
      continue;
    }

    if (degradation === "shrunk") {
      warnings.push(`"${el.id}" (priority ${el.priority}) shrunk to fit "${surface.name}".`);
    } else if (degradation === "repositioned") {
      warnings.push(`"${el.id}" (priority ${el.priority}) repositioned into leftover space on "${surface.name}".`);
    }

    const textStyle = resolveFinalTextStyle(el, finalRect, surface);
    if (textStyle.truncated) {
      warnings.push(`"${el.id}" text truncated with an ellipsis - even the minimum readable size didn't fit "${surface.name}".`);
    }

    placed.push({
      id: el.id,
      type: el.type,
      role: el.role,
      x: Math.round(finalRect.x),
      y: Math.round(finalRect.y),
      width: Math.round(finalRect.width),
      height: Math.round(finalRect.height),
      fontSize: textStyle.fontSize ? Math.round(textStyle.fontSize) : undefined,
      lineClampLines: textStyle.lineClampLines,
      truncated: textStyle.truncated,
      visible: true,
      degradation,
      rect: finalRect,
    });
  }

  // Defensive final check - this should be unreachable given the
  // algorithm above, but a layout engine should never silently ship an
  // invalid layout, so this fails loudly instead of guessing.
  const visible = placed.filter((p) => p.visible);
  for (const [i, a] of visible.entries()) {
    for (const b of visible.slice(i + 1)) {
      if (rectsOverlap(a.rect, b.rect)) {
        throw new Error(`Internal resolver invariant violated: "${a.id}" and "${b.id}" overlap on "${surface.name}".`);
      }
    }
    if (!rectWithinBounds(a.rect, contentBox)) {
      throw new Error(`Internal resolver invariant violated: "${a.id}" falls outside "${surface.name}"'s bounds.`);
    }
  }

  const elements: ResolvedElement[] = placed.map(({ rect: _rect, ...rest }) => rest);

  return {
    surfaceId: surface.id,
    surfaceWidth: surface.width,
    surfaceHeight: surface.height,
    elements,
    warnings,
    fitCleanly: warnings.length === 0,
  };
}
