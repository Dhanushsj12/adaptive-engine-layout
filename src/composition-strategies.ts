import type {
  ElementRole,
  OrientationClass,
  SurfaceProfile,
} from "./types";

/** A rectangle expressed as fractions (0..1) of the surface's content box. */
export interface RectFraction {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type CompositionTemplate =
  Readonly<Record<ElementRole, RectFraction>>;

export const COMPOSITION_TEMPLATES: Readonly<
  Record<OrientationClass, CompositionTemplate>
> = {
  portrait: {
    hero: {
      x: 0,
      y: 0,
      w: 1,
      h: 0.38,
    },

    primary: {
      x: 0.04,
      y: 0.42,
      w: 0.92,
      h: 0.17,
    },

    secondary: {
      x: 0.04,
      y: 0.8,
      w: 0.92,
      h: 0.08,
    },

    action: {
      x: 0.15,
      y: 0.65,
      w: 0.7,
      h: 0.14,
    },

    branding: {
      x: 0.35,
      y: 0.9,
      w: 0.3,
      h: 0.08,
    },
  },

  landscape: {
    hero: {
      x: 0,
      y: 0,
      w: 0.45,
      h: 1,
    },

    primary: {
      x: 0.48,
      y: 0.05,
      w: 0.48,
      h: 0.27,
    },

    secondary: {
      x: 0.48,
      y: 0.34,
      w: 0.48,
      h: 0.18,
    },

    action: {
      x: 0.48,
      y: 0.56,
      w: 0.4,
      h: 0.2,
    },

    branding: {
      x: 0.48,
      y: 0.8,
      w: 0.25,
      h: 0.14,
    },
  },

  /*
   * Wide banners are a fundamentally different composition:
   *
   *   [ HERO ] [ HEADLINE / SECONDARY ] [ CTA ] [ BRAND ]
   *
   * Everything stays in one horizontal band.
   *
   * This is important for very short surfaces such as:
   * 1920x250
   * 1200x80
   */
  "wide-banner": {
    hero: {
      x: 0.01,
      y: 0.05,
      w: 0.12,
      h: 0.9,
    },

    primary: {
      x: 0.14,
      y: 0.05,
      w: 0.40,
      h: 0.9,
    },

    secondary: {
      x: 0.55,
      y: 0.05,
      w: 0.12,
      h: 0.9,
    },

    action: {
      x: 0.68,
      y: 0.05,
      w: 0.18,
      h: 0.9,
    },

    branding: {
      x: 0.87,
      y: 0.15,
      w: 0.12,
      h: 0.7,
    },
  },

  square: {
    hero: {
      x: 0,
      y: 0,
      w: 1,
      h: 0.55,
    },

    primary: {
      x: 0.05,
      y: 0.58,
      w: 0.55,
      h: 0.16,
    },

    secondary: {
      x: 0.05,
      y: 0.75,
      w: 0.55,
      h: 0.12,
    },

    action: {
      x: 0.65,
      y: 0.6,
      w: 0.3,
      h: 0.22,
    },

    branding: {
      x: 0.8,
      y: 0.86,
      w: 0.16,
      h: 0.1,
    },
  },
};

/**
 * Classify purely from the content-box aspect ratio.
 *
 * No surface id/name is used.
 */
export function classifyOrientation(
  contentWidth: number,
  contentHeight: number
): OrientationClass {
  const aspect =
    contentWidth / contentHeight;

  if (aspect >= 4) {
    return "wide-banner";
  }

  if (aspect <= 0.85) {
    return "portrait";
  }

  if (aspect < 1.15) {
    return "square";
  }

  return "landscape";
}

export function templateFor(
  surface: SurfaceProfile,
  contentWidth: number,
  contentHeight: number
): {
  orientation: OrientationClass;
  template: CompositionTemplate;
} {
  /*
   * `surface` is intentionally accepted because this is the public
   * template-selection API, but the decision itself is based only
   * on dimensions.
   */
  void surface;

  const orientation =
    classifyOrientation(
      contentWidth,
      contentHeight
    );

  return {
    orientation,
    template:
      COMPOSITION_TEMPLATES[
        orientation
      ],
  };
}