/**
 * Core types shared across the ad spec, surface profiles, and the resolver.
 *
 * Design intent: every one of these types exists to make an INVALID ad spec
 * or surface profile hard to construct. See ARCHITECTURE.md "Type system"
 * section for the reasoning behind each choice.
 */

/** The visual "kind" of content an element carries. */
export type ElementType = "text" | "image" | "button";

/**
 * The functional role an element plays in the ad. Roles are how the resolver
 * decides *how* to lay something out (a "hero" gets the largest single
 * block; "branding" is always the first candidate for degradation) -
 * independent of which literal surface it's being resolved for.
 */
export type ElementRole =
  | "primary" // main message, e.g. a headline
  | "hero" // the dominant visual, e.g. a product photo
  | "action" // the thing the viewer should click/tap
  | "secondary" // supporting info, e.g. a price
  | "branding"; // logo / attribution - lowest priority by convention

/**
 * An element's required content. `content` is used by the text-measurement
 * utility to estimate real rendered width instead of guessing a fixed box.
 */
export interface AdElement {
  readonly id: string;
  readonly type: ElementType;
  readonly role: ElementRole;
  /** 1 = must never be dropped. Higher numbers degrade first. */
  readonly priority: number;
  /** Visible text for "text" and "button" elements. Ignored for "image". */
  readonly content?: string;
  /** Hard floor the resolver will never shrink below. */
  readonly minWidth?: number;
  readonly minHeight?: number;
  /** Used by "image" elements to keep proportions correct when resized. */
  readonly aspectRatio?: number;
}

export interface AdSpec {
  readonly id: string;
  readonly elements: readonly AdElement[];
}

export interface SafeArea {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export type ViewingDistance = "near" | "far";

/**
 * A surface profile describes real physical/interaction constraints, not
 * just pixels. The resolver's decisions are driven by these fields, not by
 * `id` or `name` - a brand-new, never-seen profile with the same shape of
 * constraints resolves correctly with zero code changes.
 */
export interface SurfaceProfile {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly safeArea?: SafeArea;
  /** Minimum tappable side length, in px, for any interactive element. */
  readonly minTapTarget?: number;
  /** Minimum font size, in px, below which text is illegible at range. */
  readonly minTextSize?: number;
  readonly viewingDistance?: ViewingDistance;
  readonly touchOnly?: boolean;
}

/** What the resolver had to do to an element to make it fit. */
export type DegradationAction = "none" | "shrunk" | "repositioned" | "dropped";

export interface ResolvedElement {
  readonly id: string;
  readonly type: ElementType;
  readonly role: ElementRole;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Only meaningful for "text" and "button" elements. */
  readonly fontSize?: number;
  /** Max lines the renderer should clamp to - prevents any residual
   * vertical overflow even if the font-size search above had to guess. */
  readonly lineClampLines?: number;
  /** True if even the minimum readable font size didn't fit - the
   * renderer should show an ellipsis rather than attempt to display the
   * full text. */
  readonly truncated?: boolean;
  readonly visible: boolean;
  readonly degradation: DegradationAction;
}

export interface ResolvedLayout {
  readonly surfaceId: string;
  readonly surfaceWidth: number;
  readonly surfaceHeight: number;
  readonly elements: readonly ResolvedElement[];
  /** Human-readable trail of every degradation decision, in order applied. */
  readonly warnings: readonly string[];
  /** True only if every element in the spec is visible with no degradation. */
  readonly fitCleanly: boolean;
}

/** The orientation class the resolver derives from a surface's *shape*,
 * never from its name or id. This is the hook that lets an unseen 5th
 * surface resolve correctly: if its content-box aspect ratio lands in the
 * "wide-banner" bucket, it gets the wide-banner composition, full stop. */
export type OrientationClass = "portrait" | "landscape" | "wide-banner" | "square";
