/**
 * Run with: npm run stress-test
 *
 * This script is the project's real proof-of-correctness. It is not a
 * formal test framework - it is a deliberately adversarial set of runs
 * against the resolver, printed in a readable form, so a reader (or an
 * interviewer) can see exactly how the algorithm behaves under pressure
 * without opening a browser.
 */
import { defineAd, button, image, text } from "../src/spec";
import { defineSurface, requiredSurfaces, impossiblyTightBanner } from "../src/surfaces";
import { resolveLayout } from "../src/resolver";
import type { AdSpec, SurfaceProfile } from "../src/types";

const productAd: AdSpec = defineAd({
  id: "summer-sale",
  elements: [
    text({ id: "headline", role: "primary", priority: 1, content: "Summer Sale - 40% Off" }),
    image({ id: "product-image", role: "hero", priority: 1, aspectRatio: 1 }),
    button({ id: "cta", role: "action", priority: 2, content: "Shop Now" }),
    text({ id: "price", role: "secondary", priority: 2, content: "$29.99" }),
    image({ id: "logo", role: "branding", priority: 3, aspectRatio: 1 }),
  ],
});

function report(label: string, spec: AdSpec, surface: SurfaceProfile): void {
  const layout = resolveLayout(spec, surface);
  console.log(`\n=== ${label} — ${surface.name} (${surface.width}x${surface.height}) ===`);
  for (const el of layout.elements) {
    const pos = el.visible ? `x:${el.x} y:${el.y} w:${el.width} h:${el.height}` : "not placed";
    console.log(`  ${el.visible ? "✓" : "✗"} ${el.id.padEnd(14)} [${el.degradation.padEnd(12)}] ${pos}`);
  }
  if (layout.warnings.length === 0) {
    console.log("  (fits cleanly - no degradation)");
  } else {
    for (const w of layout.warnings) console.log(`  ! ${w}`);
  }
}

console.log("### 1) The 4 required surfaces - same spec, meaningfully different arrangements ###");
for (const surface of requiredSurfaces) {
  report("productAd", productAd, surface);
}

console.log("\n\n### 2) Deliberately impossible case: a squat 1200x80 strip with far-viewing text ###");
console.log("minTextSize forces the headline taller than its allotted region, pushing into the");
console.log("price element stacked below it in the same column - a genuine two-element conflict.");
console.log("Expect: headline (priority 1) wins the space; price (priority 2) degrades or drops.");
report("productAd", productAd, impossiblyTightBanner);

console.log("\n\n### 3) Generalization: a surface never referenced anywhere else in this codebase ###");
const mysterySurface = defineSurface({
  id: "unseen-surface-given-live",
  name: "Unseen Surface (defined only in this script)",
  width: 2400,
  height: 300,
  minTextSize: 28,
  viewingDistance: "far",
});
console.log("This surface's id/name appear nowhere in composition-strategies.ts or resolver.ts.");
console.log("Its aspect ratio (8.0) lands it in the same bucket as broadcast-lower-third.");
report("productAd", productAd, mysterySurface);

console.log("\n\n### 4) Equal-priority conflict: two elements claiming the SAME role/region ###");
console.log("Both are 'hero', both priority 1 - they map to the identical ideal rect, so this");
console.log("cannot be resolved by the templates alone. The tiebreak has to happen at runtime.");
const tightSpec: AdSpec = defineAd({
  id: "equal-priority-conflict",
  elements: [
    image({ id: "hero-first-declared", role: "hero", priority: 1, aspectRatio: 1 }),
    image({ id: "hero-second-declared", role: "hero", priority: 1, aspectRatio: 1 }),
  ],
});
const tinySquare = defineSurface({ id: "tiny-square", name: "Tiny Square", width: 200, height: 200 });
report("tightSpec", tightSpec, tinySquare);
console.log(
  "\nTiebreak rule: Array.prototype.sort is stable, so among equal priorities elements keep their\n" +
    "declared order. hero-first-declared claims the ideal rect outright; hero-second-declared's\n" +
    "identical ideal rect is then a 100% overlap it can never shrink its way out of (shrinking\n" +
    "keeps the same anchor corner, and a same-origin rect always overlaps its twin), so it falls\n" +
    "through to the free-space search and gets repositioned - or dropped if no free space remains."
);
