import { templateFor } from "./composition-strategies";
import { clipToBounds, findLargestFreeRect, rectsOverlap, rectWithinBounds, type Rect } from "./geometry";
import { estimateLineCount, lineHeightFor, measureTextWidth } from "./text-measure";
import type { AdElement, AdSpec, DegradationAction, ResolvedElement, ResolvedLayout, SurfaceProfile } from "./types";

const SHRINK_STEPS = [1, 0.85, 0.7, 0.55, 0.4]; // fraction of ideal size tried, in order

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
 * targets, minimum legible text size at viewing distance).
 */
function hardFloor(el: AdElement, surface: SurfaceProfile): { minWidth: number; minHeight: number } {
  let minWidth = el.minWidth ?? 24;
  let minHeight = el.minHeight ?? 16;

  if (el.type === "button" && surface.touchOnly && surface.minTapTarget) {
    minWidth = Math.max(minWidth, surface.minTapTarget);
    minHeight = Math.max(minHeight, surface.minTapTarget);
  }

  if ((el.type === "text" || el.type === "button") && surface.viewingDistance === "far" && surface.minTextSize) {
    minHeight = Math.max(minHeight, lineHeightFor(surface.minTextSize));
    if (el.content) {
      const naturalWidth = measureTextWidth(el.content, surface.minTextSize);
      minWidth = Math.max(minWidth, Math.min(naturalWidth, surface.width));
    }
  }

  return { minWidth, minHeight };
}

/**
 * Chooses a font size that fits both dimensions of the resolved text box.
 * This is intentionally part of resolution rather than CSS: the renderer
 * must never receive a box that it cannot actually render without clipping.
 *
 * We start from the largest size suggested by the box height, then reduce it
 * until the measured wrapped line count fits vertically. A surface's
 * minTextSize is a hard floor, so if even that cannot fit, the caller treats
 * the candidate as invalid and can degrade/reposition/drop the element.
 */
function fontSizeForBox(
  text: string,
  boxWidth: number,
  boxHeight: number,
  surface: SurfaceProfile
): number | null {
  const hardMin = surface.minTextSize ?? 8;
  const initial = Math.max(hardMin, Math.min(boxHeight * 0.6, boxWidth / Math.max(1, text.length * 0.56)));
  const floor = Math.min(initial, hardMin);

  for (let size = initial; size >= floor - 0.01; size = Math.max(floor, size - 1)) {
    const lineHeight = lineHeightFor(size);
    const lines = estimateLineCount(text, size, Math.max(1, boxWidth));
    if (lines * lineHeight <= boxHeight + 0.5) return size;
    if (size === floor) break;
  }

  return null;
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

function shrinkTowardFloor(ideal: Rect, floor: { minWidth: number; minHeight: number }, scale: number): Rect {
  const width = Math.max(floor.minWidth, ideal.width * scale);
  const height = Math.max(floor.minHeight, ideal.height * scale);
  return { x: ideal.x, y: ideal.y, width, height };
}

export function resolveLayout(spec: AdSpec, surface: SurfaceProfile): ResolvedLayout {
  const contentBox = getContentBox(surface);
  const { template } = templateFor(surface, contentBox.width, contentBox.height);

  const ordered = [...spec.elements].sort((a, b) => a.priority - b.priority);
  const placed: Array<ResolvedElement & { rect: Rect }> = [];
  const warnings: string[] = [];

  for (const el of ordered) {
    const floor = hardFloor(el, surface);
    const ideal = idealRectFor(el, contentBox, template);
    const occupied = placed.map((p) => p.rect);

    let finalRect: Rect | null = null;
    let degradation: DegradationAction = "none";

    // 1) Try the ideal rect, then progressively smaller versions of it,
    //    anchored at the same top-left corner, down to its hard floor.
    for (const scale of SHRINK_STEPS) {
      const candidate = clipToBounds(shrinkTowardFloor(ideal, floor, scale), contentBox);
      if (candidate.width < floor.minWidth - 0.5 || candidate.height < floor.minHeight - 0.5) continue;

      if (el.type === "text" || el.type === "button") {
        const fittedFontSize = fontSizeForBox(
          el.content ?? "",
          candidate.width,
          candidate.height,
          surface
        );
        if (fittedFontSize === null) continue;
      }

      if (!occupied.some((o) => rectsOverlap(candidate, o)) && rectWithinBounds(candidate, contentBox)) {
        finalRect = candidate;
        degradation = scale === 1 ? "none" : "shrunk";
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

    const fontSize =
      el.type === "text" || el.type === "button"
        ? fontSizeForBox(el.content ?? "", finalRect.width, finalRect.height, surface) ?? surface.minTextSize ?? 8
        : undefined;

    placed.push({
      id: el.id,
      type: el.type,
      role: el.role,
      x: Math.round(finalRect.x),
      y: Math.round(finalRect.y),
      width: Math.round(finalRect.width),
      height: Math.round(finalRect.height),
      fontSize: fontSize ? Math.round(fontSize) : undefined,
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
