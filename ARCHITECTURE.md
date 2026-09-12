# Adaptive Layout Engine — Architecture

## 1. Overview

The Adaptive Layout Engine is a constraint-based layout resolver for rendering a single advertisement specification across multiple display surfaces.

The core design goal is:

> Define the advertisement once, then resolve it automatically for any surface without writing surface-specific positioning logic.

The system separates:

1. Advertisement content and intent
2. Surface constraints
3. Composition strategy
4. Geometry calculations
5. Constraint resolution
6. DOM rendering

This separation allows the same advertisement specification to be resolved against very different surfaces such as:

- Mobile Portrait — `320 × 480`
- Mobile Landscape — `480 × 320`
- Broadcast Lower Third — `1920 × 250`
- Retail Kiosk — `1080 × 1080`
- Unseen Surface — defined only by the stress test
- Impossibly Tight Banner — `1200 × 80`

The resolver does not identify surfaces by name and then choose a hardcoded layout.

Instead, it uses the surface's geometry and available constraints to select an appropriate composition strategy.

---

# 2. Design Principles

The implementation follows five primary principles.

## 2.1 One Advertisement Specification

The advertisement is defined once.

The sample advertisement contains:

- Product image
- Headline
- Price
- Call-to-action button
- Branding/logo

Example:

```ts
const sampleAdSpec = defineAd({
  id: "airpods-pro-promo",
  elements: [
    ...
  ],
});
````

The same specification is passed to the resolver for every surface.

There is no separate advertisement definition for mobile, broadcast, kiosk, or the stress-test surface.

---

## 2.2 Surface Independence

A surface describes its physical constraints rather than prescribing exact element positions.

A surface provides information such as:

* Width
* Height
* Safe-area insets
* Viewing characteristics
* Surface profile

The resolver receives this information and calculates the final layout.

The implementation intentionally avoids logic such as:

```ts
if (surface.id === "mobile") {
  ...
}

if (surface.id === "kiosk") {
  ...
}
```

This is important because the engine must also work with surfaces that were not known when the resolver was written.

---

# 3. High-Level Architecture

The system can be understood as the following pipeline:

```text
                 Advertisement Specification
                           |
                           v
                    +--------------+
                    |   spec.ts    |
                    | Validation   |
                    +--------------+
                           |
                           v
                    +--------------+
                    |  surfaces.ts |
                    | Constraints  |
                    +--------------+
                           |
                           v
              +--------------------------+
              | composition-strategies   |
              | Orientation-based        |
              | composition templates    |
              +--------------------------+
                           |
                           v
                    +--------------+
                    |  resolver.ts |
                    | Constraint   |
                    | resolution   |
                    +--------------+
                       /         \
                      /           \
                     v             v
              geometry.ts     text-measure.ts
              rectangle       text sizing
              calculations    measurements
                      \           /
                       \         /
                        v       v
                    ResolvedLayout
                           |
                           v
                    +--------------+
                    | render-dom.ts|
                    | DOM renderer |
                    +--------------+
                           |
                           v
                       Browser UI
```

The important boundary is between the resolver and renderer.

The resolver decides:

* Whether an element is visible
* Position
* Width
* Height
* Font size
* Degradation state

The renderer simply paints that resolved result.

---

# 4. File Responsibilities

## `src/types.ts`

Contains the shared TypeScript types used throughout the engine.

Important concepts include:

* Advertisement elements
* Element roles
* Surface definitions
* Rectangles
* Resolved elements
* Resolved layouts
* Degradation states

This file defines the contracts between the different parts of the system.

Keeping these contracts centralized prevents the resolver, renderer, and specification layer from developing incompatible assumptions.

---

# 5. Advertisement Specification

## `src/spec.ts`

`spec.ts` contains the advertisement definition and validation logic.

The main function is:

```ts
defineAd()
```

Its purpose is to validate the advertisement before it reaches the resolver.

Validation includes:

### Duplicate IDs

Every element must have a unique ID.

For example:

```text
product-image
headline
price
cta
logo
```

Two elements cannot share the same ID.

---

### Valid Roles

The engine supports the following roles:

```text
primary
hero
action
secondary
branding
```

An invalid role causes the specification to fail immediately.

---

### Priority Validation

Every element must have a positive priority.

The priority establishes the degradation order.

A lower numeric value means higher priority.

For example:

```text
1 = highest priority
2 = next priority
3 = next priority
...
```

This allows the resolver to protect important content when a surface becomes constrained.

---

### Image Validation

Images may optionally specify an aspect ratio.

The aspect ratio must be positive.

---

### Text Validation

Text and button elements must contain content.

This is important because text-aware resolution requires the resolver to know what text it needs to fit.

---

# 6. Element Roles

Roles describe the semantic importance of an element.

The current roles are:

| Role        | Purpose                              |
| ----------- | ------------------------------------ |
| `hero`      | Main visual/product content          |
| `primary`   | Main headline or important text      |
| `action`    | Interactive call-to-action           |
| `secondary` | Supporting information such as price |
| `branding`  | Logo or brand identity               |

Roles are intentionally semantic.

The specification does not say:

```text
put headline at x=200, y=100
```

Instead it says:

```text
this is a primary element
```

The composition strategy determines where that type of content belongs.

---

# 7. Surface Definitions

## `src/surfaces.ts`

This module contains surface construction and the required surface profiles.

The important concept is that surfaces describe constraints rather than final element positions.

The required profiles include:

```text
Mobile Portrait
320 × 480

Mobile Landscape
480 × 320

Broadcast Lower Third
1920 × 250

Retail Kiosk
1080 × 1080
```

Additional surfaces are used to demonstrate robustness:

```text
Impossibly Tight Banner
1200 × 80
```

and an unseen surface defined directly inside the stress-test script.

The unseen surface is particularly important because it demonstrates that the resolver is not simply matching known surface IDs.

---

# 8. Composition Strategies

## `src/composition-strategies.ts`

Composition strategies describe how semantic roles are arranged for different geometric conditions.

The strategies are orientation/layout patterns rather than individual surface implementations.

For example, a wide surface may naturally use a horizontal arrangement:

```text
[product] [headline] [price] [CTA] [logo]
```

A tall surface may instead use a stacked arrangement:

```text
[product]

[headline]

[CTA]

[price]

[logo]
```

The important distinction is that the strategy is selected based on geometry.

The resolver does not contain logic such as:

```ts
if (surface.name === "Mobile Portrait")
```

This preserves generalization.

---

# 9. Geometry Engine

## `src/geometry.ts`

The geometry module contains reusable rectangle calculations.

Its responsibilities include:

* Rectangle intersection
* Bounds checking
* Free-space calculations
* Finding available rectangles
* Position calculations

One important operation is:

```text
findLargestFreeRect
```

This is used when an element cannot occupy its ideal position because another element has already claimed that space.

Instead of immediately dropping the element, the resolver searches for available space.

This enables the `repositioned` degradation state.

---

# 10. Text Measurement

## `src/text-measure.ts`

Text cannot be treated as an arbitrary rectangle because text dimensions depend on:

* Font
* Font size
* Content
* Available width
* Line height

The browser implementation uses Canvas 2D text measurement.

This allows the resolver to make text-aware decisions.

In environments where browser measurement is unavailable, the module provides a documented heuristic fallback.

This is particularly important for the stress-test script because it executes without requiring the browser UI.

---

# 11. Constraint Resolver

## `src/resolver.ts`

This is the core of the project.

The resolver receives:

```text
AdSpec
+
Surface
```

and produces:

```text
ResolvedLayout
```

A resolved element contains calculated geometry and its degradation state.

Conceptually:

```text
AdSpec
   +
Surface
   |
   v
Strategy selection
   |
   v
Ideal rectangles
   |
   v
Fit checks
   |
   v
Conflict resolution
   |
   v
Degradation
   |
   v
ResolvedLayout
```

---

# 12. Resolution Process

The resolver follows a priority-aware process.

## Step 1 — Select a composition strategy

The surface geometry is analyzed.

The resolver selects an appropriate strategy based on characteristics such as orientation and available dimensions.

The surface identity itself is not used as a layout switch.

---

## Step 2 — Generate ideal rectangles

Each element receives an ideal rectangle from the selected composition strategy.

An ideal rectangle describes the preferred:

```text
x
y
width
height
```

for that element.

---

## Step 3 — Process elements according to priority

Elements are resolved according to their priority.

Higher-priority elements are protected before lower-priority elements.

This is necessary because constrained surfaces may not have enough room for every element at its ideal size.

---

## Step 4 — Check whether the ideal rectangle fits

The resolver checks:

* Surface bounds
* Safe-area constraints
* Existing occupied rectangles
* Minimum dimensions
* Text fit
* Element-specific constraints

If the ideal rectangle fits, the element is placed without degradation.

---

# 13. Degradation Model

The resolver uses explicit degradation states.

The important states are:

```text
none
shrunk
repositioned
dropped
```

These states are visible in the stress-test output and are also exposed to the renderer.

---

## 13.1 `none`

The element fits normally.

Example:

```text
headline [none]
```

No adaptation is necessary.

---

## 13.2 `shrunk`

The ideal element cannot fit at its preferred size, but it can fit after reducing its size while respecting the applicable minimum constraints.

Example from the mobile portrait case:

```text
headline [shrunk]
```

This demonstrates real constraint handling rather than simply clipping the text.

---

## 13.3 `repositioned`

The ideal rectangle is unavailable, but another suitable free region exists.

The resolver uses the geometry module to search for available space.

Example:

```text
price [repositioned]
logo  [repositioned]
```

This means the element remains visible but moves away from its preferred position.

---

## 13.4 `dropped`

If no acceptable placement remains, the element is removed.

Dropping is the final degradation option.

The important rule is that higher-priority elements are protected before lower-priority elements are sacrificed.

---

# 14. Priority and Conflict Resolution

Priority is one of the core constraints.

For example:

```text
Priority 1
    |
Priority 2
    |
Priority 3
    |
Priority 4
    |
Priority 5
```

When space becomes constrained, the resolver attempts to preserve higher-priority content.

The deliberately impossible `1200 × 80` banner demonstrates this.

The stress test produces:

```text
headline [dropped]
product-image [none]
cta [none]
price [none]
logo [none]
```

The important result is that the resolver does not simply clip everything.

It makes an explicit degradation decision.

---

# 15. Equal-Priority Tie Breaking

The resolver also handles equal-priority conflicts.

The stress test creates two hero elements with the same priority and the same ideal region.

The result is:

```text
hero-first-declared  [none]
hero-second-declared [repositioned]
```

The rule is deterministic:

> When priority is equal, declaration order is preserved.

Therefore, the first element claims the ideal rectangle.

The next element must search for another available region.

If no valid region exists, it may eventually be dropped.

This makes the system deterministic and reproducible.

---

# 16. Unseen Surface Generalization

One of the most important tests is the unseen surface.

The stress-test script creates a surface that is not part of the normal surface definitions.

It is deliberately not referenced by:

```text
composition-strategies.ts
resolver.ts
```

The resolver still successfully produces a layout.

This demonstrates that the system is driven by:

```text
surface geometry
+
constraints
+
semantic roles
```

rather than by a list of known surface IDs.

This is a central requirement of the architecture.

---

# 17. DOM Rendering

## `src/render-dom.ts`

The renderer converts a `ResolvedLayout` into DOM elements.

The renderer does not independently calculate layout.

It uses the exact geometry supplied by the resolver:

```text
x
y
width
height
```

This separation is important.

The resolver owns layout decisions.

The renderer owns visual presentation.

---

# 18. Product Image Rendering

Image elements are rendered using an actual `<img>` element.

The product image is loaded from the public asset path.

The renderer applies:

```text
width: 100%
height: 100%
object-fit: contain
object-position: center
```

This keeps the product image inside the rectangle selected by the resolver without changing the resolver's geometry.

The actual asset can therefore be replaced without changing the layout algorithm.

---

# 19. Text Rendering

Text elements are rendered as DOM text.

The renderer applies the font size produced by the resolver.

For example:

```ts
label.style.fontSize = `${element.fontSize ?? 14}px`;
```

When the resolver specifies a line clamp, the renderer applies the corresponding clamp to the inner text element.

The outer element remains a flex container for centering.

This separation prevents flex layout and `-webkit-line-clamp` from interfering with each other.

---

# 20. Responsive Preview Scaling

The demo renders the surface at its true logical pixel dimensions.

For example:

```text
320 × 480
480 × 320
1920 × 250
1080 × 1080
```

The preview is then scaled to fit the available browser frame.

This distinction is important:

> Preview scaling is a UI concern, not layout resolution.

The resolver still calculates the layout using the actual surface dimensions.

The renderer uses CSS transforms only to make the resolved surface fit inside the available demo area.

---

# 21. Demo

## `demo/`

The demo provides the interactive browser interface.

It allows the user to switch between surface profiles and visually inspect the resolved layout.

The UI is intentionally secondary to the resolver.

The stress-test script is the authoritative non-browser demonstration of the algorithm.

---

# 22. Stress Tests

## `scripts/stress-test.ts`

The stress test validates four important behaviors.

---

## Scenario 1 — Required Surfaces

The same advertisement is resolved against all four required surfaces.

Current required surfaces:

```text
Mobile Portrait
320 × 480

Mobile Landscape
480 × 320

Broadcast Lower Third
1920 × 250

Retail Kiosk
1080 × 1080
```

The output demonstrates different arrangements rather than simply scaling one fixed layout.

For example, the mobile portrait result contains:

```text
headline [shrunk]
product-image [none]
cta [none]
price [repositioned]
logo [repositioned]
```

while the other surfaces can fit the elements without degradation.

---

# 23. Scenario 2 — Impossible Banner

The stress test uses:

```text
1200 × 80
```

This surface is deliberately too short.

The purpose is to prove that the resolver performs actual constraint resolution.

The current output demonstrates:

```text
headline [dropped]
product-image [none]
cta [none]
price [none]
logo [none]
```

The dropped element is reported explicitly rather than being silently clipped.

---

# 24. Scenario 3 — Unseen Surface

The stress test creates an additional surface directly inside the script.

It is not added to the normal strategy definitions.

The resolver still produces a valid layout.

This verifies generalization.

The test would be significantly weaker if the resolver simply contained a lookup table of known surface names.

---

# 25. Scenario 4 — Equal-Priority Conflict

Two hero elements are deliberately assigned the same priority and ideal region.

The resolver demonstrates deterministic tie-breaking:

```text
first declared element
        ↓
claims ideal region

second declared element
        ↓
searches remaining space
        ↓
repositioned or dropped
```

This verifies that conflict resolution is deterministic.

---

# 26. Verification Commands

The project can be verified using the following commands.

## Install dependencies

```bash
npm install
```

## Start development server

```bash
npm run dev
```

## Type-check

```bash
npm run typecheck
```

The project currently passes TypeScript validation.

## Run stress tests

```bash
npm run stress-test
```

The stress-test scenarios currently execute successfully.

## Production build

```bash
npm run build
```

The production build currently completes successfully.

---

# 27. Current Verification Status

The current implementation has been verified through:

```text
✓ TypeScript type-check
✓ Mobile Portrait
✓ Mobile Landscape
✓ Broadcast Lower Third
✓ Retail Kiosk
✓ Impossibly Tight Banner
✓ Unseen Surface
✓ Equal-priority conflict
✓ Production build
✓ Real product image rendering
✓ DOM rendering
✓ Responsive preview scaling
```

The `npm test` command is not currently part of the package scripts.

The project's automated verification command is:

```bash
npm run stress-test
```

rather than:

```bash
npm test
```

---

# 28. Known Limitations

The engine intentionally has several limitations.

## Text wrapping

Text wrapping is modeled from measured single-line width and line height.

It is not intended to reproduce the complete browser word-breaking algorithm.

The resolver nevertheless uses text measurement to avoid knowingly placing text into boxes that are too small.

---

## Free-space search

The free-space search uses a deterministic grid-based approach.

The grid is:

```text
40 × 40
```

This keeps the algorithm fast and predictable.

Because it is grid-based rather than pixel-exact, it can occasionally under-report the mathematically largest available rectangle.

---

## No global backtracking

The resolver does not perform unlimited global optimization.

Once a higher-priority element has been successfully placed, the engine does not repeatedly move that element to optimize the placement of every lower-priority element.

This is intentional.

The architecture prioritizes:

```text
priority guarantees
+
deterministic behavior
+
predictable degradation
```

over globally optimal packing.

---

## No animation

Switching surfaces in the demo does not currently use animation or transitions.

This is a presentation limitation and does not affect the resolver.

---

# 29. Why the Architecture Matters

The main value of this project is not that it can place five elements on a screen.

The important part is that the layout decision is separated from the surface identity.

A traditional implementation might look like:

```ts
if (surface === "mobile") {
  ...
}

if (surface === "broadcast") {
  ...
}

if (surface === "kiosk") {
  ...
}
```

That approach becomes increasingly difficult to maintain as new surfaces are introduced.

This architecture instead follows:

```text
Advertisement intent
        +
Surface constraints
        +
Semantic roles
        +
Geometry
        +
Text measurement
        ↓
Constraint resolution
        ↓
Resolved layout
```

As a result, a new surface can be introduced without modifying the resolver specifically for that surface.

---

# 30. Final Architecture Summary

The complete system can be summarized as:

```text
                 ONE AD SPEC
                      |
                      v
              +---------------+
              |   Validation  |
              |   spec.ts     |
              +---------------+
                      |
                      v
              +---------------+
              |    Surface    |
              |  constraints  |
              +---------------+
                      |
                      v
              +---------------+
              | Composition   |
              |   Strategy    |
              +---------------+
                      |
                      v
              +---------------+
              |   Resolver    |
              |               |
              | priority      |
              | fit checks    |
              | conflicts     |
              | degradation   |
              +---------------+
                 /          \
                /            \
               v              v
        geometry.ts     text-measure.ts
                \            /
                 \          /
                  v        v
              RESOLVED LAYOUT
                      |
                      v
              +---------------+
              | DOM Renderer  |
              | render-dom.ts |
              +---------------+
                      |
                      v
                   DEMO UI
```

The engine therefore provides:

* One reusable advertisement specification
* Multiple fundamentally different surfaces
* Geometry-driven composition
* Constraint-aware placement
* Text-aware sizing
* Priority-based degradation
* Deterministic conflict resolution
* Repositioning into available space
* Explicit dropping when necessary
* Generalization to unseen surfaces
* Real DOM rendering
* Production build support
* Browser-based interactive visualization
* Non-browser adversarial stress testing

The implementation is intentionally designed so that adding another surface does not require adding a new surface-specific branch to the resolver.

````

