import type { SafeArea, SurfaceProfile } from "./types";

export class InvalidSurfaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSurfaceError";
  }
}

const DEFAULT_SAFE_AREA: SafeArea = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

/**
 * Defines a surface profile.
 *
 * Validation happens at construction time so invalid surface constraints
 * are reported before the resolver attempts to place any elements.
 *
 * Examples of invalid configurations:
 * - Non-positive or non-finite dimensions
 * - Negative safe-area insets
 * - Safe area consuming the entire surface
 * - Invalid minimum tap target
 * - Invalid minimum text size
 *
 * For touch surfaces, an omitted minTapTarget defaults to 44px.
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
  if (!input.id.trim()) {
    throw new InvalidSurfaceError(
      "Surface id must be a non-empty string."
    );
  }

  if (!input.name.trim()) {
    throw new InvalidSurfaceError(
      `Surface "${input.id}" must have a non-empty name.`
    );
  }

  if (
    !Number.isFinite(input.width) ||
    !Number.isFinite(input.height) ||
    input.width <= 0 ||
    input.height <= 0
  ) {
    throw new InvalidSurfaceError(
      `Surface "${input.id}" must have positive finite width and height.`
    );
  }

  const safeArea = input.safeArea ?? DEFAULT_SAFE_AREA;

  const safeAreaValues = [
    safeArea.top,
    safeArea.right,
    safeArea.bottom,
    safeArea.left,
  ];

  if (
    safeAreaValues.some(
      (value) => !Number.isFinite(value) || value < 0
    )
  ) {
    throw new InvalidSurfaceError(
      `Surface "${input.id}" has invalid safe-area insets. ` +
        "Insets must be finite and non-negative."
    );
  }

  const horizontalSafeArea =
    safeArea.left + safeArea.right;

  const verticalSafeArea =
    safeArea.top + safeArea.bottom;

  if (
    horizontalSafeArea >= input.width ||
    verticalSafeArea >= input.height
  ) {
    throw new InvalidSurfaceError(
      `Surface "${input.id}" has a safe area that consumes the entire surface - ` +
        "nothing could ever be placed."
    );
  }

  if (
    input.minTapTarget !== undefined &&
    (
      !Number.isFinite(input.minTapTarget) ||
      input.minTapTarget <= 0
    )
  ) {
    throw new InvalidSurfaceError(
      `Surface "${input.id}" has an invalid minTapTarget. ` +
        "The value must be a positive finite number."
    );
  }

  if (
    input.minTextSize !== undefined &&
    (
      !Number.isFinite(input.minTextSize) ||
      input.minTextSize <= 0
    )
  ) {
    throw new InvalidSurfaceError(
      `Surface "${input.id}" has an invalid minTextSize. ` +
        "The value must be a positive finite number."
    );
  }

  if (
    input.viewingDistance !== undefined &&
    input.viewingDistance !== "near" &&
    input.viewingDistance !== "far"
  ) {
    throw new InvalidSurfaceError(
      `Surface "${input.id}" has an invalid viewingDistance. ` +
        'Expected "near" or "far".'
    );
  }

  /**
   * Touch surfaces require a minimum interaction target.
   *
   * If no value is provided, use the 44px baseline rather than allowing
   * the resolver to create unusably small interactive controls.
   */
  const minTapTarget = input.touchOnly
    ? input.minTapTarget ?? 44
    : input.minTapTarget;

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

/**
 * The four surfaces required by the assignment.
 */
export const mobilePortrait = defineSurface({
  id: "mobile-portrait",
  name: "Mobile Portrait",
  width: 320,
  height: 480,
  safeArea: {
    top: 12,
    right: 12,
    bottom: 24,
    left: 12,
  },
  minTapTarget: 44,
  touchOnly: true,
  viewingDistance: "near",
});

export const mobileLandscape = defineSurface({
  id: "mobile-landscape",
  name: "Mobile Landscape",
  width: 480,
  height: 320,
  safeArea: {
    top: 8,
    right: 16,
    bottom: 8,
    left: 16,
  },
  minTapTarget: 44,
  touchOnly: true,
  viewingDistance: "near",
});

export const broadcastLowerThird = defineSurface({
  id: "broadcast-lower-third",
  name: "Broadcast Lower Third",
  width: 1920,
  height: 250,
  safeArea: {
    top: 10,
    right: 80,
    bottom: 10,
    left: 80,
  },
  minTextSize: 32,
  viewingDistance: "far",
});

export const retailKiosk = defineSurface({
  id: "retail-kiosk",
  name: "Retail Kiosk",
  width: 1080,
  height: 1080,
  safeArea: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
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
 * An intentionally constrained surface used by the stress tests and demo.
 *
 * This surface is short enough that:
 *
 * 1. The far-viewing-distance minimum text size forces the headline
 *    to consume more vertical space than its ideal allocation.
 * 2. The headline conflicts with the price element below it.
 * 3. The resolver must attempt shrink, reposition and finally drop
 *    lower-priority content when necessary.
 *
 * This demonstrates genuine constraint resolution rather than clipping
 * or simply scaling the complete advertisement uniformly.
 */
export const impossiblyTightBanner = defineSurface({
  id: "impossibly-tight-banner",
  name: "Impossibly Tight Banner (stress test)",
  width: 1200,
  height: 80,
  safeArea: {
    top: 8,
    right: 40,
    bottom: 8,
    left: 40,
  },
  minTapTarget: 44,
  touchOnly: true,
  minTextSize: 28,
  viewingDistance: "far",
});