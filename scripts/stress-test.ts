/**
 * Run with:
 *
 * npm run stress-test
 *
 * This verifies that the same fictional product advertisement
 * can be resolved across different surfaces without hardcoded
 * layouts for each surface.
 */

import {
  defineAd,
  button,
  image,
  text,
} from "../src/spec";

import {
  defineSurface,
  requiredSurfaces,
  impossiblyTightBanner,
} from "../src/surfaces";

import { resolveLayout } from "../src/resolver";

import type {
  AdSpec,
  ResolvedLayout,
  SurfaceProfile,
} from "../src/types";

/**
 * Single source advertisement specification.
 *
 * Fictional product:
 * NovaBuds Pro
 *
 * Fictional price:
 * ₹2,999
 */
const productAd: AdSpec = defineAd({
  id: "nova-buds-pro",

  elements: [
    text({
      id: "headline",
      role: "primary",
      priority: 1,
      content: "NovaBuds Pro - Premium Sound",
    }),

    image({
      id: "product-image",
      role: "hero",
      priority: 1,
      aspectRatio: 1,
      content: "/image.png",
    }),

    button({
      id: "cta",
      role: "action",
      priority: 2,
      content: "Shop Now",
    }),

    text({
      id: "price",
      role: "secondary",
      priority: 2,
      content: "₹2,999",
    }),

    image({
      id: "logo",
      role: "branding",
      priority: 3,
      aspectRatio: 1,
      content: "/image.png",
    }),
  ],
});

function report(
  label: string,
  spec: AdSpec,
  surface: SurfaceProfile
): ResolvedLayout {
  const layout = resolveLayout(
    spec,
    surface
  );

  console.log(
    `\n=== ${label} — ${surface.name} (${surface.width}x${surface.height}) ===`
  );

  for (const el of layout.elements) {
    const pos = el.visible
      ? `x:${el.x} y:${el.y} w:${el.width} h:${el.height}`
      : "not placed";

    console.log(
      `  ${el.visible ? "✓" : "✗"} ` +
      `${el.id.padEnd(14)} ` +
      `[${el.degradation.padEnd(12)}] ` +
      pos
    );
  }

  if (layout.warnings.length === 0) {
    console.log(
      "  (fits cleanly - no degradation)"
    );
  } else {
    for (const warning of layout.warnings) {
      console.log(
        `  ! ${warning}`
      );
    }
  }

  return layout;
}

function assert(
  condition: boolean,
  message: string
): void {
  if (!condition) {
    throw new Error(message);
  }
}

function elementById(
  layout: ResolvedLayout,
  id: string
) {
  const element = layout.elements.find(
    (candidate) => candidate.id === id
  );

  assert(
    Boolean(element),
    `Expected resolved element "${id}".`
  );

  return element!;
}

console.log(
  "### 1) Same advertisement across the 4 required surfaces ###"
);

for (const surface of requiredSurfaces) {
  report(
    "novaBudsProAd",
    productAd,
    surface
  );
}

console.log(
  "\n\n### 2) Deliberately impossible case: 1200x80 banner ###"
);

console.log(
  "The surface is intentionally too short for all ideal element sizes."
);

console.log(
  "The resolver must protect higher-priority elements first and degrade lower-priority elements when necessary."
);

const tightBannerLayout = report(
  "novaBudsProAd",
  productAd,
  impossiblyTightBanner
);

assert(
  elementById(tightBannerLayout, "headline").visible,
  "Priority-1 headline should stay visible on the tight banner."
);

assert(
  elementById(tightBannerLayout, "product-image").visible,
  "Priority-1 product image should stay visible on the tight banner."
);

assert(
  elementById(tightBannerLayout, "cta").visible,
  "Priority-2 CTA should stay visible before lower-priority branding is considered."
);

assert(
  tightBannerLayout.warnings.some((warning) =>
    warning.includes("headline") &&
    warning.includes("truncated")
  ),
  "Tight banner should demonstrate controlled headline truncation."
);

console.log(
  "\n\n### 3) Generalization: unseen surface ###"
);

const mysterySurface = defineSurface({
  id: "unseen-surface-given-live",

  name: "Unseen Surface (defined only in this script)",

  width: 2400,
  height: 300,

  minTextSize: 28,

  viewingDistance: "far",
});

console.log(
  "This surface is defined only in the stress-test."
);

console.log(
  "It is not referenced by composition-strategies.ts or resolver.ts."
);

console.log(
  "The resolver selects a strategy from the surface geometry/aspect ratio."
);

report(
  "novaBudsProAd",
  productAd,
  mysterySurface
);

console.log(
  "\n\n### 4) Equal-priority conflict ###"
);

console.log(
  "Two hero elements have the same priority and same ideal region."
);

const tightSpec: AdSpec = defineAd({
  id: "equal-priority-conflict",

  elements: [
    image({
      id: "hero-first-declared",
      role: "hero",
      priority: 1,
      aspectRatio: 1,
      content: "/image.png",
    }),

    image({
      id: "hero-second-declared",
      role: "hero",
      priority: 1,
      aspectRatio: 1,
      content: "/image.png",
    }),
  ],
});

const tinySquare = defineSurface({
  id: "tiny-square",
  name: "Tiny Square",
  width: 200,
  height: 200,
});

report(
  "tightSpec",
  tightSpec,
  tinySquare
);

console.log(
  "\nTiebreak rule: equal-priority elements preserve their declared order."
);

console.log(
  "The first hero claims the ideal rectangle."
);

console.log(
  "The second hero cannot occupy the same rectangle, so the resolver searches for free space and repositions it or drops it if necessary."
);
