import type { ElementRole, OrientationClass, SurfaceProfile } from "./types";

/** A rectangle expressed as fractions (0..1) of the surface's content box. */
export interface RectFraction {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type CompositionTemplate = Readonly<Record<ElementRole, RectFraction>>;

/**
 * One template per orientation class. These are the "meaningfully
 * different" arrangements the assignment asks for - a portrait surface
 * gets a vertical stack, a wide banner gets a horizontal strip, a square
 * surface gets an image-over-controls split. None of this is keyed by
 * surface id or name (see classifySurface in resolver.ts) - a surface the
 * resolver has never seen gets whichever template matches its computed
 * aspect ratio.
 */
export const COMPOSITION_TEMPLATES: Readonly<Record<OrientationClass, CompositionTemplate>> = {
  portrait: {
    hero: { x: 0, y: 0, w: 1.0, h: 0.4 },
    primary: { x: 0, y: 0.44, w: 1.0, h: 0.12 },
    secondary: { x: 0, y: 0.58, w: 1.0, h: 0.08 },
    action: { x: 0.15, y: 0.68, w: 0.7, h: 0.14 },
    branding: { x: 0.35, y: 0.86, w: 0.3, h: 0.1 },
  },
  landscape: {
    hero: { x: 0, y: 0, w: 0.45, h: 1.0 },
    primary: { x: 0.48, y: 0, w: 0.52, h: 0.3 },
    secondary: { x: 0.48, y: 0.32, w: 0.52, h: 0.18 },
    action: { x: 0.48, y: 0.54, w: 0.4, h: 0.2 },
    branding: { x: 0.48, y: 0.8, w: 0.25, h: 0.14 },
  },
  "wide-banner": {
    hero: { x: 0, y: 0.05, w: 0.15, h: 0.9 },
    primary: { x: 0.18, y: 0.08, w: 0.46, h: 0.5 },
    secondary: { x: 0.18, y: 0.6, w: 0.46, h: 0.32 },
    action: { x: 0.67, y: 0.2, w: 0.16, h: 0.6 },
    branding: { x: 0.86, y: 0.3, w: 0.12, h: 0.4 },
  },
  square: {
    hero: { x: 0, y: 0, w: 1.0, h: 0.55 },
    primary: { x: 0.05, y: 0.58, w: 0.55, h: 0.16 },
    secondary: { x: 0.05, y: 0.75, w: 0.55, h: 0.12 },
    action: { x: 0.65, y: 0.6, w: 0.3, h: 0.22 },
    branding: { x: 0.8, y: 0.86, w: 0.16, h: 0.1 },
  },
};

/**
 * Classifies a surface into an orientation purely from its *content box
 * shape* (width/height after safe-area insets) - never from its id or
 * name. This is what lets the resolver generalize to a surface it has
 * never seen: give it any width/height and it lands in one of these four
 * buckets and gets that bucket's template.
 */
export function classifyOrientation(contentWidth: number, contentHeight: number): OrientationClass {
  const aspect = contentWidth / contentHeight;
  if (aspect >= 4) return "wide-banner";
  if (aspect <= 0.85) return "portrait";
  if (aspect < 1.15) return "square";
  return "landscape";
}

export function templateFor(surface: SurfaceProfile, contentWidth: number, contentHeight: number): {
  orientation: OrientationClass;
  template: CompositionTemplate;
} {
  const orientation = classifyOrientation(contentWidth, contentHeight);
  return { orientation, template: COMPOSITION_TEMPLATES[orientation] };
}
