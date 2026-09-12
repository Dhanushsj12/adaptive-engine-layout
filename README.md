# Adaptive Layout Engine for Multi-Surface Ads

A constraint-based layout resolver that takes **one ad specification** and adapts it across fundamentally different surfaces — a tall mobile interstitial, a wide broadcast lower-third, a square retail kiosk, and surfaces it has never seen before — without any `if (surface === "x")` branch.

## Live Demo

**[Adaptive Layout Engine — Proof Sheet](https://adaptive-engine-layout.vercel.app/)**

The live demo allows you to switch between the required surfaces and inspect how the same advertisement is resolved differently for each geometry.

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL, typically:

```text
http://localhost:5173
```

Use the surface list to switch between the required profiles, the intentionally brutal stress-test surface, and the unseen surface.

## Type Check

```bash
npm run typecheck
```

The complete TypeScript project passes type checking with no errors.

## Production Build

```bash
npm run build
```

The production bundle is generated successfully with Vite.

## Stress Test

The resolver can be tested without the browser:

```bash
npm run stress-test
```

The stress test covers four important cases.

### 1. Required Surfaces

The same advertisement specification is resolved across:

* Mobile Portrait — `320×480`
* Mobile Landscape — `480×320`
* Broadcast Lower Third — `1920×250`
* Retail Kiosk — `1080×1080`

The layouts are meaningfully different rather than simply scaling one fixed composition.

### Mobile Portrait

![Mobile Portrait](screenshots/mobileportrait.png)

### Mobile Landscape

![Mobile Landscape](screenshots/mobilelandscape.png)

### Broadcast Lower Third

![Broadcast Lower Third](screenshots/broadcastlowerthird.png)

### Retail Kiosk

![Retail Kiosk](screenshots/retailkiosk.png)

## 2. Deliberately Impossible Surface

The stress test includes an intentionally tight:

```text
1200×80
```

banner.

The available height is insufficient for all ideal element sizes. The resolver therefore applies its priority and degradation rules instead of silently clipping content.

In the actual resolver output, the lower-priority/conflicting content is dropped while the remaining elements remain valid.

![Impossible Banner](screenshots/impossibly.png)

### Stress-Test Evidence

The following screenshots show the continuous stress-test output.

![Stress Test 1](screenshots/stresstest1.png)

![Stress Test 2](screenshots/stresstest2.png)

![Stress Test 3](screenshots/stresstest3.png)

The output demonstrates:

* priority-aware placement
* shrinking when required
* repositioning into available space
* dropping when no valid placement remains
* preservation of higher-priority elements
* deterministic conflict resolution

## 3. Unseen-Surface Generalization

The project also tests a surface that is defined only inside:

```text
scripts/stress-test.ts
```

It is not added to:

```text
src/composition-strategies.ts
src/resolver.ts
```

This is intentional.

The resolver determines an appropriate composition from surface geometry and aspect ratio rather than checking for a specific surface name.

![Unseen Surface](screenshots/unseen.png)

This demonstrates that a new surface can be introduced without adding a new surface-specific branch to the resolver.

## 4. Equal-Priority Conflict

The stress test creates two hero elements with the same priority and the same ideal region.

The resolver preserves declared order:

1. The first element claims the ideal rectangle.
2. The second element detects the occupied region.
3. The resolver searches for remaining free space.
4. The second element is repositioned when valid space exists.
5. If no valid space exists, degradation can continue according to the resolver rules.

This verifies deterministic behavior when priority alone cannot break a conflict.

## Architecture

```text
Ad Specification
       │
       ▼
   Validation
   defineAd()
       │
       ▼
 Surface Geometry
       │
       ▼
 Composition Strategy
       │
       ▼
 Constraint Resolver
       │
       ├── Ideal placement
       ├── Collision detection
       ├── Text-aware sizing
       ├── Shrink
       ├── Reposition
       └── Drop
       │
       ▼
 Resolved Layout
       │
       ▼
 DOM Renderer
```

## Project Structure

```text
src/
├── types.ts
├── spec.ts
├── surfaces.ts
├── composition-strategies.ts
├── resolver.ts
├── geometry.ts
├── text-measure.ts
└── render-dom.ts

demo/
└── Interactive Vite demo

scripts/
└── stress-test.ts

screenshots/
├── mobileportrait.png
├── mobilelandscape.png
├── broadcastlowerthird.png
├── retailkiosk.png
├── impossibly.png
├── unseen.png
├── stresstest1.png
├── stresstest2.png
└── stresstest3.png

ARCHITECTURE.md
README.md
```

### `src/types.ts`

Defines the type system used throughout the layout engine, including advertisement elements, roles, surfaces, resolved geometry, and degradation states.

### `src/spec.ts`

Provides `defineAd()` and convenience constructors for text, image, and button elements.

It validates the advertisement specification before layout resolution.

### `src/surfaces.ts`

Defines `defineSurface()` and the required surface profiles.

### `src/composition-strategies.ts`

Contains orientation/aspect-ratio-based composition strategies rather than surface-name-specific resolver branches.

### `src/resolver.ts`

Contains the core constraint-resolution algorithm.

It is responsible for:

* prioritization
* ideal placement
* fit checking
* text-aware constraints
* shrinking
* repositioning
* dropping
* deterministic conflict handling

### `src/geometry.ts`

Contains rectangle calculations, collision checks, and the free-space search used during repositioning.

### `src/text-measure.ts`

Uses real browser Canvas 2D text measurement and provides a documented fallback for Node-based stress testing.

### `src/render-dom.ts`

Converts the resolved layout into actual DOM elements for the interactive demo.

### `demo/`

Contains the Vite/TypeScript interactive proof sheet used to visually inspect the resolved layouts.

### `scripts/stress-test.ts`

Contains adversarial tests for required surfaces, impossible constraints, unseen surfaces, and equal-priority conflicts.

## Constraint and Degradation Model

The resolver follows a priority-aware degradation model.

Conceptually:

```text
Ideal placement
      │
      ▼
Does it fit?
 ┌────┴────┐
 │         │
YES       NO
 │         │
 ▼         ▼
Place    Shrink
           │
           ▼
        Re-check
           │
           ▼
       Reposition
           │
           ▼
          Drop
```

Higher-priority elements are protected before lower-priority elements.

This prevents the resolver from sacrificing important content merely to preserve every element.

## Why This Is Not Uniform Scaling

A simple scaling solution would shrink the entire advertisement uniformly.

This implementation instead resolves each element independently against the target surface.

For example, on the mobile portrait surface:

* the headline can shrink
* the price can be repositioned
* the logo can be repositioned
* the product image can retain its own resolved geometry
* the CTA maintains its own placement constraints

The resulting composition therefore changes structurally instead of merely becoming smaller.

## Text-Aware Layout

Text is measured before accepting a resolved rectangle.

The resolver considers:

* font size
* measured text width
* line height
* available width
* available height
* minimum readable size

This allows the resolver to reject placements that would knowingly produce invalid text rendering.

## Determinism

The resolver is deterministic.

For equal-priority elements, declared order is used as the tiebreaker.

This makes stress-test results reproducible and prevents arbitrary layout changes between runs.

## Known Limitations

### Text Wrapping

Text wrapping is modeled from measured single-line width and line height.

It is not intended to reproduce every browser word-breaking behavior.

The resolver nevertheless uses the measurements to reject boxes that cannot reasonably contain the rendered text.

### Free-Space Search

`findLargestFreeRect()` uses a fixed `40×40` grid.

This keeps the search fast and deterministic, but it is not pixel-exact and can occasionally under-report the true largest free rectangle by a small amount.

### No Backtracking

Only one resolution attempt per element is made at each degradation stage.

The resolver does not backtrack and move an already-placed higher-priority element simply to improve the placement of a lower-priority element.

This is intentional because the priority guarantee requires higher-priority elements to remain protected.

### Demo Transitions

The demo does not currently use animation or transitions when switching surfaces.

## Browser Compatibility

The implementation uses standard:

* DOM APIs
* Canvas 2D text measurement
* ResizeObserver
* standard CSS

It is intended for current Chrome, Edge, Firefox, and Safari.

## Verification

The following commands are used to verify the project:

```bash
npm run typecheck
npm run stress-test
npm run build
```

All three verification commands complete successfully.

The stress test additionally verifies:

* required surface resolution
* impossible constraint handling
* unseen-surface generalization
* equal-priority conflict handling

## Time Spent

Approximately **3days**, including implementation, debugging, stress testing, documentation, deployment, and visual verification.


Every stress-test scenario documented in this repository was executed against the actual resolver during development. The reported coordinates and degradation states are therefore based on real resolver output rather than hypothetical examples.
