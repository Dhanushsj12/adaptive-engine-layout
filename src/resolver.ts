import { templateFor } from "./composition-strategies";
import {
  clipToBounds,
  findLargestFreeRect,
  rectsOverlap,
  rectWithinBounds,
  type Rect,
} from "./geometry";
import {
  fitTextRequiredHeight,
  fitTextToFixedBox,
  measureTextWidth,
} from "./text-measure";
import type {
  AdElement,
  AdSpec,
  DegradationAction,
  ElementRole,
  ResolvedElement,
  ResolvedLayout,
  SurfaceProfile,
} from "./types";

const SHRINK_STEPS = [1, 0.85, 0.7, 0.55, 0.4];

const MAX_LINES_BY_ROLE: Record<ElementRole, number> = {
  hero: 1,
  primary: 2,
  secondary: 1,
  action: 1,
  branding: 1,
};

type WorkingResolvedElement = ResolvedElement & {
  rect: Rect;
};

function maxLinesFor(
  role: ElementRole,
  surface: SurfaceProfile
): number {
  return MAX_LINES_BY_ROLE[role] ?? 1;
}

/**
 * Ensures clean pixel integer conversion while guarding against 1px overlap rounding errors.
 */
function snapToPixelGrid(rect: Rect): Rect {
  const x = Math.floor(rect.x);
  const y = Math.floor(rect.y);
  const right = Math.ceil(rect.x + rect.width);
  const bottom = Math.ceil(rect.y + rect.height);

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function getContentBox(surface: SurfaceProfile): Rect {
  const safeArea = surface.safeArea ?? {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  return {
    x: safeArea.left,
    y: safeArea.top,
    width: surface.width - safeArea.left - safeArea.right,
    height: surface.height - safeArea.top - safeArea.bottom,
  };
}

function hardFloor(
  el: AdElement,
  surface: SurfaceProfile,
  idealWidth: number
): { minWidth: number; minHeight: number } {
  let minWidth = el.minWidth ?? 24;
  let minHeight = el.minHeight ?? 16;

  if (el.type === "button" && surface.touchOnly && surface.minTapTarget) {
    minWidth = Math.max(minWidth, surface.minTapTarget);
    minHeight = Math.max(minHeight, surface.minTapTarget);
  }

  if ((el.type === "text" || el.type === "button") && el.content) {
    const minFontSize = surface.minTextSize ?? 11;
    const maxLines = maxLinesFor(el.role, surface);

    const fit = fitTextRequiredHeight(
      el.content,
      Math.max(idealWidth, minWidth),
      maxLines,
      minFontSize,
      minFontSize
    );

    minHeight = Math.max(minHeight, fit.requiredHeight);

    if (surface.viewingDistance === "far") {
      const longestWordWidth = el.content
        .split(/\s+/)
        .filter(Boolean)
        .reduce(
          (widest, word) =>
            Math.max(widest, measureTextWidth(word, minFontSize)),
          0
        );

      minWidth = Math.max(
        minWidth,
        Math.min(longestWordWidth + 16, idealWidth)
      );
    }
  }

  return { minWidth, minHeight };
}

function idealRectFor(
  el: AdElement,
  contentBox: Rect,
  template: ReturnType<typeof templateFor>["template"]
): Rect {
  const fraction = template[el.role] ?? { x: 0, y: 0, w: 1, h: 1 };

  return snapToPixelGrid({
    x: contentBox.x + fraction.x * contentBox.width,
    y: contentBox.y + fraction.y * contentBox.height,
    width: fraction.w * contentBox.width,
    height: fraction.h * contentBox.height,
  });
}

function contentAwareIdealRect(
  el: AdElement,
  ideal: Rect,
  surface: SurfaceProfile,
  contentBox: Rect
): { rect: Rect; preferredFontSize: number } {
  if ((el.type !== "text" && el.type !== "button") || !el.content) {
    return { rect: ideal, preferredFontSize: 0 };
  }

  const maxLines = maxLinesFor(el.role, surface);

  const preferredFontSize = Math.min(
    64,
    Math.max(surface.minTextSize ?? 12, Math.round(ideal.height * 0.55))
  );

  const fit = fitTextRequiredHeight(
    el.content,
    ideal.width,
    maxLines,
    preferredFontSize,
    surface.minTextSize ?? 11
  );

  const requiredHeight = fit.requiredHeight + 4;

  /*
   * Bound maximum height extension to remain inside parent surface content box
   */
  const maxHeightPossible = contentBox.y + contentBox.height - ideal.y;
  const targetHeight = Math.min(
    maxHeightPossible,
    Math.max(ideal.height, requiredHeight)
  );

  return {
    rect: snapToPixelGrid({
      ...ideal,
      height: targetHeight,
    }),
    preferredFontSize: fit.fontSize,
  };
}

function shrinkTowardFloor(
  ideal: Rect,
  floor: { minWidth: number; minHeight: number },
  scale: number
): Rect {
  return snapToPixelGrid({
    x: ideal.x,
    y: ideal.y,
    width: Math.max(floor.minWidth, ideal.width * scale),
    height: Math.max(floor.minHeight, ideal.height * scale),
  });
}

function resolveFinalTextStyle(
  el: AdElement,
  finalRect: Rect,
  surface: SurfaceProfile
): { fontSize?: number; lineClampLines?: number; truncated: boolean } {
  if ((el.type !== "text" && el.type !== "button") || !el.content) {
    return { truncated: false };
  }

  const maxLines = maxLinesFor(el.role, surface);

  const preferredFontSize = Math.min(
    64,
    Math.max(surface.minTextSize ?? 12, Math.round(finalRect.height * 0.55))
  );

  const fit = fitTextToFixedBox(
    el.content,
    finalRect.width,
    finalRect.height,
    maxLines,
    preferredFontSize,
    surface.minTextSize ?? 10
  );

  if (fit) {
    return {
      fontSize: fit.fontSize,
      lineClampLines: fit.lineCount,
      truncated: false,
    };
  }

  return {
    fontSize: surface.minTextSize ?? 10,
    lineClampLines: maxLines,
    truncated: true,
  };
}

function shouldDropUnreadablePrimary(
  el: AdElement,
  rect: Rect,
  floor: { minWidth: number; minHeight: number },
  surface: SurfaceProfile,
  truncated: boolean
): boolean {
  if (el.type !== "text" || el.role !== "primary" || !el.content || !truncated) {
    return false;
  }

  const extremelyShort =
    rect.height <= Math.max(floor.minHeight + 1, (surface.minTextSize ?? 11) * 1.75);
  const extremelyNarrow = rect.width <= floor.minWidth + 1;

  return extremelyShort || extremelyNarrow;
}

function isCandidateValid(
  candidate: Rect,
  occupied: Rect[],
  contentBox: Rect,
  floor: { minWidth: number; minHeight: number }
): boolean {
  if (
    candidate.width < floor.minWidth - 0.5 ||
    candidate.height < floor.minHeight - 0.5
  ) {
    return false;
  }

  if (!rectWithinBounds(candidate, contentBox)) {
    return false;
  }

  return !occupied.some((other) => rectsOverlap(candidate, other));
}

function findBestTemplateCandidate(
  ideal: Rect,
  floor: { minWidth: number; minHeight: number },
  contentBox: Rect,
  occupied: Rect[]
): { rect: Rect; degradation: DegradationAction } | null {
  for (const scale of SHRINK_STEPS) {
    const candidate = clipToBounds(
      shrinkTowardFloor(ideal, floor, scale),
      contentBox
    );

    if (isCandidateValid(candidate, occupied, contentBox, floor)) {
      return {
        rect: candidate,
        degradation:
          scale === 1 && candidate.height <= ideal.height + 0.5
            ? "none"
            : "shrunk",
      };
    }
  }

  return null;
}

function findRepositionCandidate(
  ideal: Rect,
  floor: { minWidth: number; minHeight: number },
  contentBox: Rect,
  occupied: Rect[]
): Rect | null {
  const free = findLargestFreeRect(contentBox, occupied);

  if (!free) return null;

  if (free.width < floor.minWidth || free.height < floor.minHeight) {
    return null;
  }

  const candidate: Rect = snapToPixelGrid({
    x: free.x,
    y: free.y,
    width: Math.min(ideal.width, free.width),
    height: Math.min(ideal.height, free.height),
  });

  if (!isCandidateValid(candidate, occupied, contentBox, floor)) {
    return null;
  }

  return candidate;
}

function withoutRect(element: WorkingResolvedElement): ResolvedElement {
  const { rect: _rect, ...resolved } = element;
  return resolved;
}

function makeDroppedElement(el: AdElement): WorkingResolvedElement {
  return {
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
  };
}

function elementPriority(element: WorkingResolvedElement): number {
  return (
    (element as WorkingResolvedElement & { priority?: number }).priority ??
    Number.MAX_SAFE_INTEGER
  );
}

function attachPriority(
  element: WorkingResolvedElement,
  priority: number
): WorkingResolvedElement {
  return Object.assign(element, { priority });
}

function tryPlaceElement(
  el: AdElement,
  ideal: Rect,
  floor: { minWidth: number; minHeight: number },
  contentBox: Rect,
  occupied: Rect[]
): { rect: Rect; degradation: DegradationAction } | null {
  const direct = findBestTemplateCandidate(ideal, floor, contentBox, occupied);
  if (direct) return direct;

  const repositioned = findRepositionCandidate(
    ideal,
    floor,
    contentBox,
    occupied
  );
  if (repositioned) {
    return {
      rect: repositioned,
      degradation: "repositioned",
    };
  }

  return null;
}

export function resolveLayout(
  spec: AdSpec,
  surface: SurfaceProfile
): ResolvedLayout {
  const contentBox = getContentBox(surface);
  const { template } = templateFor(
    surface,
    contentBox.width,
    contentBox.height
  );

  const ordered = spec.elements
    .map((element, index) => ({ element, index }))
    .sort(
      (a, b) =>
        a.element.priority - b.element.priority || a.index - b.index
    );

  const placed: WorkingResolvedElement[] = [];
  const warnings: string[] = [];

  for (const entry of ordered) {
    const el = entry.element;
    const templateIdeal = idealRectFor(el, contentBox, template);

    const { rect: ideal } = contentAwareIdealRect(
      el,
      templateIdeal,
      surface,
      contentBox
    );

    const floor = hardFloor(el, surface, ideal.width);

    let occupied = placed.filter((p) => p.visible).map((p) => p.rect);

    let placement = tryPlaceElement(
      el,
      ideal,
      floor,
      contentBox,
      occupied
    );

    /*
     * Priority Preemption
     */
    if (!placement) {
      const lowerPriority = placed.filter(
        (p) => p.visible && elementPriority(p) > el.priority
      );

      if (lowerPriority.length > 0) {
        const protectedPlaced = placed.filter(
          (p) => !p.visible || elementPriority(p) <= el.priority
        );

        occupied = protectedPlaced.filter((p) => p.visible).map((p) => p.rect);

        placement = tryPlaceElement(
          el,
          ideal,
          floor,
          contentBox,
          occupied
        );

        if (placement) {
          for (const lower of lowerPriority) {
            const index = placed.indexOf(lower);
            if (index >= 0) {
              placed[index] = makeDroppedElement(
                spec.elements.find((c) => c.id === lower.id) ?? {
                  id: lower.id,
                  type: lower.type,
                  role: lower.role,
                  priority: elementPriority(lower),
                } as AdElement
              );

              warnings.push(
                `"${lower.id}" (priority ${elementPriority(
                  lower
                )}) dropped to protect higher-priority "${el.id}" (priority ${el.priority}) on "${surface.name}".`
              );
            }
          }
        }
      }
    }

    if (!placement) {
      occupied = placed.filter((p) => p.visible).map((p) => p.rect);
      placement = tryPlaceElement(
        el,
        ideal,
        floor,
        contentBox,
        occupied
      );
    }

    if (!placement) {
      warnings.push(
        `"${el.id}" (priority ${el.priority}, role ${el.role}) dropped: no legal space remains on "${surface.name}" after protecting higher-priority content.`
      );

      placed.push(attachPriority(makeDroppedElement(el), el.priority));
      continue;
    }

    const finalRect = snapToPixelGrid(placement.rect);
    const textStyle = resolveFinalTextStyle(el, finalRect, surface);

    if (
      shouldDropUnreadablePrimary(
        el,
        finalRect,
        floor,
        surface,
        textStyle.truncated
      )
    ) {
      const lowerPriority = placed.filter(
        (p) => p.visible && elementPriority(p) > el.priority
      );

      if (lowerPriority.length > 0) {
        for (const lower of lowerPriority) {
          const index = placed.indexOf(lower);
          if (index >= 0) {
            placed[index] = makeDroppedElement(
              spec.elements.find((c) => c.id === lower.id) ?? {
                id: lower.id,
                type: lower.type,
                role: lower.role,
                priority: elementPriority(lower),
              } as AdElement
            );

            warnings.push(
              `"${lower.id}" (priority ${elementPriority(
                lower
              )}) dropped to preserve readable "${el.id}" (priority ${el.priority}) on "${surface.name}".`
            );
          }
        }

        occupied = placed.filter((p) => p.visible).map((p) => p.rect);
        const retry = tryPlaceElement(
          el,
          ideal,
          floor,
          contentBox,
          occupied
        );

        if (retry) {
          const snappedRetryRect = snapToPixelGrid(retry.rect);
          const retryStyle = resolveFinalTextStyle(
            el,
            snappedRetryRect,
            surface
          );

          if (
            !shouldDropUnreadablePrimary(
              el,
              snappedRetryRect,
              floor,
              surface,
              retryStyle.truncated
            )
          ) {
            placement = retry;

            const resolvedRetry = attachPriority(
              {
                id: el.id,
                type: el.type,
                role: el.role,
                x: snappedRetryRect.x,
                y: snappedRetryRect.y,
                width: snappedRetryRect.width,
                height: snappedRetryRect.height,
                fontSize: retryStyle.fontSize
                  ? Math.round(retryStyle.fontSize)
                  : undefined,
                lineClampLines: retryStyle.lineClampLines,
                truncated: retryStyle.truncated,
                visible: true,
                degradation: retry.degradation,
                rect: snappedRetryRect,
              },
              el.priority
            );

            placed.push(resolvedRetry);
            continue;
          }
        }
      }

      warnings.push(
        `"${el.id}" (priority ${el.priority}, role ${el.role}) dropped: no readable space remains on "${surface.name}" after protecting higher-priority content.`
      );

      placed.push(attachPriority(makeDroppedElement(el), el.priority));
      continue;
    }

    if (placement.degradation === "shrunk") {
      warnings.push(
        `"${el.id}" (priority ${el.priority}) shrunk to fit "${surface.name}".`
      );
    } else if (placement.degradation === "repositioned") {
      warnings.push(
        `"${el.id}" (priority ${el.priority}) repositioned into leftover space on "${surface.name}".`
      );
    }

    if (textStyle.truncated) {
      warnings.push(
        `"${el.id}" text truncated with an ellipsis - even the minimum readable size didn't fit "${surface.name}".`
      );
    }

    placed.push(
      attachPriority(
        {
          id: el.id,
          type: el.type,
          role: el.role,
          x: finalRect.x,
          y: finalRect.y,
          width: finalRect.width,
          height: finalRect.height,
          fontSize: textStyle.fontSize
            ? Math.round(textStyle.fontSize)
            : undefined,
          lineClampLines: textStyle.lineClampLines,
          truncated: textStyle.truncated,
          visible: true,
          degradation: placement.degradation,
          rect: finalRect,
        },
        el.priority
      )
    );
  }

  /*
   * Invariant Validation
   */
  const visible = placed.filter((p) => p.visible);

  for (let i = 0; i < visible.length; i++) {
    const a = visible[i]!;

    for (const b of visible.slice(i + 1)) {
      if (rectsOverlap(a.rect, b.rect)) {
        throw new Error(
          `Internal resolver invariant violated: "${a.id}" and "${b.id}" overlap on "${surface.name}".`
        );
      }
    }

    if (!rectWithinBounds(a.rect, contentBox)) {
      throw new Error(
        `Internal resolver invariant violated: "${a.id}" falls outside "${surface.name}"'s bounds.`
      );
    }
  }

  const elements: ResolvedElement[] = placed.map(withoutRect);

  return {
    surfaceId: surface.id,
    surfaceWidth: surface.width,
    surfaceHeight: surface.height,
    elements,
    warnings,
    fitCleanly: warnings.length === 0,
  };
}