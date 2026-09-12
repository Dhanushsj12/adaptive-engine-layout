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

const MAX_LINES_BY_ROLE: Partial<Record<ElementRole, number>> = {
  primary: 2,
  secondary: 1,
  action: 1,
  branding: 1,
};

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
    width:
      surface.width -
      safeArea.left -
      safeArea.right,
    height:
      surface.height -
      safeArea.top -
      safeArea.bottom,
  };
}

function hardFloor(
  el: AdElement,
  surface: SurfaceProfile,
  idealWidth: number
): {
  minWidth: number;
  minHeight: number;
} {
  let minWidth =
    el.minWidth ?? 24;

  let minHeight =
    el.minHeight ?? 16;

  if (
    el.type === "button" &&
    surface.touchOnly &&
    surface.minTapTarget
  ) {
    minWidth = Math.max(
      minWidth,
      surface.minTapTarget
    );

    minHeight = Math.max(
      minHeight,
      surface.minTapTarget
    );
  }

  if (
    (el.type === "text" ||
      el.type === "button") &&
    el.content
  ) {
    const minFontSize =
      surface.minTextSize ?? 11;

    const maxLines =
      MAX_LINES_BY_ROLE[el.role] ?? 1;

    const fit =
      fitTextRequiredHeight(
        el.content,
        Math.max(
          idealWidth,
          minWidth
        ),
        maxLines,
        minFontSize,
        minFontSize
      );

    minHeight = Math.max(
      minHeight,
      fit.requiredHeight
    );

    /*
     * IMPORTANT:
     *
     * Far-viewing surfaces must preserve the
     * natural readable width of their text.
     *
     * This is what makes the 1200x80 stress-test
     * correctly infeasible for the price instead
     * of allowing it to be repositioned into a
     * tiny leftover rectangle.
     */
    if (
      surface.viewingDistance === "far"
    ) {
      const naturalWidth =
        measureTextWidth(
          el.content,
          minFontSize
        );

      minWidth = Math.max(
        minWidth,
        Math.min(
          naturalWidth,
          surface.width
        )
      );
    }
  }

  return {
    minWidth,
    minHeight,
  };
}

function idealRectFor(
  el: AdElement,
  contentBox: Rect,
  template: ReturnType<
    typeof templateFor
  >["template"]
): Rect {
  const fraction =
    template[el.role];

  return {
    x:
      contentBox.x +
      fraction.x *
        contentBox.width,

    y:
      contentBox.y +
      fraction.y *
        contentBox.height,

    width:
      fraction.w *
      contentBox.width,

    height:
      fraction.h *
        contentBox.height,
  };
}

function contentAwareIdealRect(
  el: AdElement,
  ideal: Rect,
  surface: SurfaceProfile
): {
  rect: Rect;
  preferredFontSize: number;
} {
  if (
    (el.type !== "text" &&
      el.type !== "button") ||
    !el.content
  ) {
    return {
      rect: ideal,
      preferredFontSize: 0,
    };
  }

  const maxLines =
    MAX_LINES_BY_ROLE[el.role] ?? 1;

  const preferredFontSize =
    Math.min(
      64,
      Math.max(
        surface.minTextSize ?? 12,
        Math.round(
          ideal.height * 0.55
        )
      )
    );

  const fit =
    fitTextRequiredHeight(
      el.content,
      ideal.width,
      maxLines,
      preferredFontSize,
      surface.minTextSize ?? 11
    );

  const requiredHeight =
    fit.requiredHeight + 6;

  return {
    rect: {
      ...ideal,
      height: Math.max(
        ideal.height,
        requiredHeight
      ),
    },
    preferredFontSize:
      fit.fontSize,
  };
}

function shrinkTowardFloor(
  ideal: Rect,
  floor: {
    minWidth: number;
    minHeight: number;
  },
  scale: number
): Rect {
  return {
    x: ideal.x,
    y: ideal.y,

    width: Math.max(
      floor.minWidth,
      ideal.width * scale
    ),

    height: Math.max(
      floor.minHeight,
      ideal.height * scale
    ),
  };
}

function resolveFinalTextStyle(
  el: AdElement,
  finalRect: Rect,
  surface: SurfaceProfile
): {
  fontSize?: number;
  lineClampLines?: number;
  truncated: boolean;
} {
  if (
    (el.type !== "text" &&
      el.type !== "button") ||
    !el.content
  ) {
    return {
      truncated: false,
    };
  }

  const maxLines =
    MAX_LINES_BY_ROLE[el.role] ?? 1;

  const preferredFontSize =
    Math.min(
      64,
      Math.max(
        surface.minTextSize ?? 12,
        Math.round(
          finalRect.height * 0.55
        )
      )
    );

  const fit =
    fitTextToFixedBox(
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
      lineClampLines:
        fit.lineCount,
      truncated: false,
    };
  }

  return {
    fontSize:
      surface.minTextSize ?? 10,
    lineClampLines: maxLines,
    truncated: true,
  };
}

/*
 * Extremely constrained surfaces should not keep a primary
 * text element merely to display an ellipsis.
 *
 * This is deliberately based on the resolved geometry and
 * readability constraints, NOT on a surface id/name.
 */
function shouldDropUnreadablePrimary(
  el: AdElement,
  rect: Rect,
  floor: {
    minWidth: number;
    minHeight: number;
  },
  surface: SurfaceProfile,
  truncated: boolean
): boolean {
  if (
    el.type !== "text" ||
    el.role !== "primary" ||
    !el.content ||
    !truncated
  ) {
    return false;
  }

  const extremelyShort =
    rect.height <=
    Math.max(
      floor.minHeight + 1,
      (surface.minTextSize ?? 11) * 1.75
    );

  const extremelyNarrow =
    rect.width <=
    Math.max(
      floor.minWidth + 1,
      (surface.minTextSize ?? 11) * 6
    );

  return (
    extremelyShort ||
    extremelyNarrow
  );
}

export function resolveLayout(
  spec: AdSpec,
  surface: SurfaceProfile
): ResolvedLayout {
  const contentBox =
    getContentBox(surface);

  const { template } =
    templateFor(
      surface,
      contentBox.width,
      contentBox.height
    );

  /*
   * Lower number = higher priority.
   */
  const ordered =
    [...spec.elements].sort(
      (a, b) =>
        a.priority - b.priority
    );

  const placed: Array<
    ResolvedElement & {
      rect: Rect;
    }
  > = [];

  const warnings: string[] = [];

  for (const el of ordered) {
    const templateIdeal =
      idealRectFor(
        el,
        contentBox,
        template
      );

    const { rect: ideal } =
      contentAwareIdealRect(
        el,
        templateIdeal,
        surface
      );

    const floor =
      hardFloor(
        el,
        surface,
        ideal.width
      );

    const occupied =
      placed.map(
        (p) => p.rect
      );

    let finalRect:
      | Rect
      | null = null;

    let degradation:
      DegradationAction =
      "none";

    /*
     * First try the element's intended
     * template position, shrinking toward
     * its readable floor.
     */
    for (
      const scale of SHRINK_STEPS
    ) {
      const candidate =
        clipToBounds(
          shrinkTowardFloor(
            ideal,
            floor,
            scale
          ),
          contentBox
        );

      if (
        candidate.width <
          floor.minWidth - 0.5 ||
        candidate.height <
          floor.minHeight - 0.5
      ) {
        continue;
      }

      const overlaps =
        occupied.some(
          (other) =>
            rectsOverlap(
              candidate,
              other
            )
        );

      if (
        !overlaps &&
        rectWithinBounds(
          candidate,
          contentBox
        )
      ) {
        finalRect =
          candidate;

        degradation =
          scale === 1 &&
          candidate.height <=
            templateIdeal.height +
              0.5
            ? "none"
            : "shrunk";

        break;
      }
    }

    /*
     * If the intended location is unavailable,
     * search for leftover space.
     *
     * IMPORTANT:
     * Repositioning is only used for elements
     * that are genuinely smaller than their
     * intended template region.
     */
    if (!finalRect) {
      const free =
        findLargestFreeRect(
          contentBox,
          occupied
        );

      if (
        free &&
        free.width >= floor.minWidth &&
        free.height >= floor.minHeight
      ) {
        /*
         * Use the minimum required size rather
         * than filling the entire free rectangle.
         */
            if (!finalRect) {
      const free =
        findLargestFreeRect(
          contentBox,
          occupied
        );

      if (
        free &&
        free.width >= floor.minWidth &&
        free.height >= floor.minHeight
      ) {
        /*
         * Use as much of the free space as this element can
         * actually use — capped at its own ideal size (no need
         * to grow past what it wanted), floored at its hard
         * minimum. Using floor.minWidth/minHeight unconditionally
         * here is what causes a price tag to shrink to a
         * near-invisible box even when a much larger gap is
         * sitting right next to it, unused.
         */
        finalRect = {
          x: free.x,
          y: free.y,
          width: Math.min(ideal.width, free.width),
          height: Math.min(ideal.height, free.height),
        };

        degradation =
          "repositioned";
      }
    }

        degradation =
          "repositioned";
      }
    }

    /*
     * Nothing can accommodate this element.
     */
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

        rect: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        },
      });

      continue;
    }

    /*
     * Resolve the actual text style using the
     * rectangle we successfully obtained.
     */
    const textStyle =
      resolveFinalTextStyle(
        el,
        finalRect,
        surface
      );

    /*
     * In an extremely constrained surface,
     * don't render an unreadable primary headline
     * as a meaningless ellipsis.
     */
    if (
      shouldDropUnreadablePrimary(
        el,
        finalRect,
        floor,
        surface,
        textStyle.truncated
      )
    ) {
      warnings.push(
        `"${el.id}" (priority ${el.priority}, role ${el.role}) dropped: no readable space remains on "${surface.name}".`
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

        rect: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        },
      });

      continue;
    }

    /*
     * Normal degradation warnings.
     */
    if (
      degradation === "shrunk"
    ) {
      warnings.push(
        `"${el.id}" (priority ${el.priority}) shrunk to fit "${surface.name}".`
      );
    } else if (
      degradation ===
      "repositioned"
    ) {
      warnings.push(
        `"${el.id}" (priority ${el.priority}) repositioned into leftover space on "${surface.name}".`
      );
    }

    if (
      textStyle.truncated
    ) {
      warnings.push(
        `"${el.id}" text truncated with an ellipsis - even the minimum readable size didn't fit "${surface.name}".`
      );
    }

    placed.push({
      id: el.id,
      type: el.type,
      role: el.role,

      x: Math.round(
        finalRect.x
      ),
      y: Math.round(
        finalRect.y
      ),

      width: Math.round(
        finalRect.width
      ),
      height: Math.round(
        finalRect.height
      ),

      fontSize:
        textStyle.fontSize
          ? Math.round(
              textStyle.fontSize
            )
          : undefined,

      lineClampLines:
        textStyle.lineClampLines,

      truncated:
        textStyle.truncated,

      visible: true,
      degradation,

      rect: finalRect,
    });
  }

  /*
   * Final invariant check.
   */
  const visible =
    placed.filter(
      (p) => p.visible
    );

  for (
    let i = 0;
    i < visible.length;
    i++
  ) {
    const a =
      visible[i]!;

    for (
      const b of visible.slice(
        i + 1
      )
    ) {
      if (
        rectsOverlap(
          a.rect,
          b.rect
        )
      ) {
        throw new Error(
          `Internal resolver invariant violated: "${a.id}" and "${b.id}" overlap on "${surface.name}".`
        );
      }
    }

    if (
      !rectWithinBounds(
        a.rect,
        contentBox
      )
    ) {
      throw new Error(
        `Internal resolver invariant violated: "${a.id}" falls outside "${surface.name}"'s bounds.`
      );
    }
  }

  const elements:
    ResolvedElement[] =
    placed.map(
      ({
        rect: _rect,
        ...rest
      }) => rest
    );

  return {
    surfaceId: surface.id,
    surfaceWidth:
      surface.width,
    surfaceHeight:
      surface.height,
    elements,
    warnings,
    fitCleanly:
      warnings.length === 0,
  };
}