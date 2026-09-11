import type { SafeArea, SurfaceProfile } from "./types";

export class InvalidSurfaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSurfaceError";
  }
}

const DEFAULT_SAFE_AREA: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Defines a surface profile. Validates internally-inconsistent constraint
 * combinations at construction time - e.g. a touch surface with no
 * minTapTarget silently defaults to a sane value rather than failing later
 * inside the resolver with a confusing error.
 */
export function defineSurface(input: {
  id: string;
  name: string;
  width: number;
  height: number;
  safeArea?: SafeArea;
  minTapTarget?: number;
  minTextSize?: number;
  viewingDistance?: "near" | "far";
  touchOnly?: boolean;
}): SurfaceProfile {
  if (input.width <= 0 || input.height <= 0) {
    throw new InvalidSurfaceError(`Surface "${input.id}" must have positive width and height.`);
  }

  const safeArea = input.safeArea ?? DEFAULT_SAFE_AREA;
  if (
    safeArea.left + safeArea.right >= input.width ||
    safeArea.top + safeArea.bottom >= input.height
  ) {
    throw new InvalidSurfaceError(
      `Surface "${input.id}" has a safe area that consumes the entire surface - nothing could ever be placed.`
    );
  }

  // A touch surface without a stated tap target still needs a real floor -
  // 44px is the common accessibility baseline (iOS HIG / WCAG target size).
  const minTapTarget = input.touchOnly ? input.minTapTarget ?? 44 : input.minTapTarget;

  return {
    id: input.id,
    name: input.name,
    width: input.width,
    height: input.height,
    safeArea,
    minTapTarget,
    minTextSize: input.minTextSize,
    viewingDistance: input.viewingDistance,
    touchOnly: input.touchOnly,
  };
}

/** The 4 surfaces the assignment requires the demo to support. */
export const mobilePortrait = defineSurface({
  id: "mobile-portrait",
  name: "Mobile Portrait",
  width: 320,
  height: 480,
  safeArea: { top: 12, right: 12, bottom: 24, left: 12 },
  minTapTarget: 44,
  touchOnly: true,
  viewingDistance: "near",
});

export const mobileLandscape = defineSurface({
  id: "mobile-landscape",
  name: "Mobile Landscape",
  width: 480,
  height: 320,
  safeArea: { top: 8, right: 16, bottom: 8, left: 16 },
  minTapTarget: 44,
  touchOnly: true,
  viewingDistance: "near",
});

export const broadcastLowerThird = defineSurface({
  id: "broadcast-lower-third",
  name: "Broadcast Lower Third",
  width: 1920,
  height: 250,
  safeArea: { top: 10, right: 80, bottom: 10, left: 80 }, // broadcast title-safe margin
  minTextSize: 32,
  viewingDistance: "far",
});

export const retailKiosk = defineSurface({
  id: "retail-kiosk",
  name: "Retail Kiosk",
  width: 1080,
  height: 1080,
  safeArea: { top: 20, right: 20, bottom: 20, left: 20 },
  minTapTarget: 60,
  touchOnly: true,
  viewingDistance: "near",
});

export const requiredSurfaces: readonly SurfaceProfile[] = [
  mobilePortrait,
  mobileLandscape,
  broadcastLowerThird,
  retailKiosk,
];

/**
 * An intentionally brutal surface used by the stress tests and the demo's
 * "unseen surface" picker to prove real degradation, not just clipping.
 *
 * Its content box is short enough that the far-viewing-distance minimum
 * text height (from minTextSize) forces the headline taller than its
 * allotted region - which pushes down into the price element stacked
 * below it in the same column. That is a genuine two-element conflict,
 * not just one element failing to fit its own space: this is where
 * shrink -> reposition -> drop actually earns its keep. See
 * ARCHITECTURE.md "Why this surface is the real stress test".
 */
export const impossiblyTightBanner = defineSurface({
  id: "impossibly-tight-banner",
  name: "Impossibly Tight Banner (stress test)",
  width: 1200,
  height: 80,
  safeArea: { top: 8, right: 40, bottom: 8, left: 40 },
  minTapTarget: 44,
  touchOnly: true,
  minTextSize: 28,
  viewingDistance: "far",
});
