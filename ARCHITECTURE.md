# Adaptive Layout Engine — Architecture

## 1. System Goal

The Adaptive Layout Engine takes **one advertisement specification** and resolves it into a concrete layout for different output surfaces.

The important architectural constraint is:

> The resolver must not know the identity of a surface.

There is no logic such as:

```ts
if (surface === "mobilePortrait") {
  ...
}
```

Instead, the resolver receives:

* advertisement content and priorities
* surface dimensions and constraints
* reusable composition strategies

It then produces a `ResolvedLayout`.

The same ad can therefore be rendered as:

* Mobile Portrait
* Mobile Landscape
* Broadcast Lower Third
* Retail Kiosk
* an unseen surface with previously unknown dimensions
* an intentionally impossible tight banner

---

# 2. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │     AdSpec           │
                    │                     │
                    │ elements             │
                    │ roles                │
                    │ priorities           │
                    │ content              │
                    │ aspect ratios        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Resolver       │
                    │                     │
                    │ strategy selection  │
                    │ ideal geometry      │
                    │ priority ordering   │
                    │ collision handling  │
                    │ degradation          │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
       ┌─────────────────┐         ┌──────────────────┐
       │ Surface         │         │ Geometry         │
       │ Constraints     │         │ Utilities        │
       │                 │         │                  │
       │ width           │         │ intersection     │
       │ height          │         │ free rectangles  │
       │ orientation     │         │ containment      │
       │ viewing distance│         │ overlap          │
       └─────────────────┘         └──────────────────┘
                 │
                 └──────────────┬──────────────┘
                                ▼
                     ┌─────────────────────┐
                     │  ResolvedLayout     │
                     │                     │
                     │ x / y               │
                     │ width / height      │
                     │ visibility          │
                     │ degradation         │
                     │ font size           │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │   DOM Renderer      │
                     │                     │
                     │   render-dom.ts     │
                     └─────────────────────┘
```

---

# 3. `src/types.ts`

This file defines the shared domain model.

The main types are:

* `AdElement`
* `AdSpec`
* `SurfaceSpec`
* `ElementRole`
* `ResolvedElement`
* `ResolvedLayout`
* degradation states

The type system separates:

```text
What the advertisement wants
```

from:

```text
What the resolver was able to produce
```

That distinction is important.

For example, an ad element may request a large headline, while the resolved element may receive:

```text
smaller font size
different position
smaller rectangle
or visibility = false
```

The resolver therefore produces a new resolved representation instead of mutating the original advertisement specification.

---

# 4. Advertisement Specification

## `src/spec.ts`

`defineAd()` is responsible for validating an advertisement specification.

Validation happens before layout resolution.

The validation checks include:

### Duplicate IDs

Every element must have a unique identifier.

```text
headline
product-image
price
cta
logo
```

Two elements cannot use the same ID.

### Valid roles

The supported roles are:

```text
hero
primary
secondary
action
branding
```

An unknown role is rejected immediately.

### Priority

Every element must have a positive priority.

The priority determines which elements receive space first during resolution.

Lower numeric priority means higher importance.

For example:

```text
1 = highest priority
2 = next priority
3 = lower priority
```

### Image aspect ratio

If an image specifies an aspect ratio, it must be positive.

### Text content

Text and button elements must contain content because the resolver needs to measure the content before deciding whether a rectangle is large enough.

---

# 5. Convenience Constructors

`spec.ts` also provides:

```ts
text(...)
image(...)
button(...)
```

These are convenience helpers around the underlying `AdElement` representation.

They keep advertisement definitions concise while still passing through the same validation system.

---

# 6. `src/surfaces.ts`

This file defines surface constraints.

A surface contains physical or logical constraints such as:

```text
width
height
orientation
viewing distance
minimum text size
padding
```

The important architectural decision is that surfaces describe **constraints**, not hard-coded element coordinates.

The resolver should be able to receive a completely new width and height and still attempt to produce a valid arrangement.

The project includes four required surface profiles:

```text
Mobile Portrait
Mobile Landscape
Broadcast Lower Third
Retail Kiosk
```

The project also exercises:

```text
1200 × 80
```

as an intentionally impossible banner.

A fifth unseen surface is created only in the stress-test script.

---

# 7. Composition Strategies

## `src/composition-strategies.ts`

Composition strategies describe preferred arrangements for different geometric conditions.

They are not individual surface implementations.

The strategy system is based on properties such as:

```text
orientation
aspect ratio
available dimensions
```

rather than surface identity.

Conceptually:

```text
portrait
    ↓
portrait-oriented composition

wide landscape
    ↓
horizontal composition

square / near-square
    ↓
stacked or balanced composition
```

This allows the resolver to generalize to surfaces that were not explicitly listed in the strategy file.

The strategy supplies preferred regions.

The resolver remains responsible for deciding whether those regions can actually fit.

---

# 8. `src/geometry.ts`

This module contains rectangle and spatial utilities.

Important operations include:

* rectangle intersection
* overlap detection
* containment
* rectangle clamping
* free-space search
* largest available free rectangle

The geometry layer is deliberately independent of advertisement content.

That means it does not know:

```text
what a headline means
what a button means
what a logo means
```

It only understands rectangles and spatial relationships.

This keeps the geometry reusable by the resolver.

---

# 9. Free-Space Search

The repositioning stage uses:

```text
findLargestFreeRect(...)
```

to search for available space after higher-priority elements have already been placed.

The implementation uses a fixed:

```text
40 × 40
```

grid.

This provides:

* deterministic behavior
* predictable runtime
* simple implementation
* sufficiently good approximation for the demo

The result is not guaranteed to be the mathematically perfect largest rectangle.

It can occasionally under-report the true available region by a few percent.

---

# 10. `src/text-measure.ts`

Text measurement is an important part of the resolver.

The engine should not simply assume that text fits because the rectangle has sufficient geometric dimensions.

The browser implementation uses Canvas 2D text measurement.

This allows the resolver to estimate:

```text
text width
font size
line height
number of lines
```

before committing an element to a rectangle.

The Node/stress-test environment uses a documented heuristic fallback because browser Canvas APIs are not necessarily available there.

This makes the resolver executable both:

```text
inside the browser
```

and:

```text
from scripts/stress-test.ts
```

---

# 11. Resolver

## `src/resolver.ts`

This is the core of the project.

The resolver combines:

```text
AdSpec
+
SurfaceSpec
+
CompositionStrategy
+
Geometry utilities
+
Text measurement
```

and produces:

```text
ResolvedLayout
```

The resolver does not render anything.

It only decides:

```text
where an element goes
how large it is
whether it remains visible
whether it was degraded
```

This separation makes the algorithm testable without requiring a browser.

---

# 12. Resolution Pipeline

The resolution process is conceptually:

```text
1. Validate advertisement
        ↓
2. Inspect surface geometry
        ↓
3. Select composition strategy
        ↓
4. Generate preferred rectangles
        ↓
5. Order elements by priority
        ↓
6. Attempt ideal placement
        ↓
7. Check geometry and text fit
        ↓
8. Attempt degradation if required
        ↓
9. Search free space when repositioning
        ↓
10. Drop an element if no valid placement remains
        ↓
11. Return ResolvedLayout
```

The renderer never participates in this decision process.

---

# 13. Priority Model

Priority is the main protection mechanism.

Elements are resolved according to priority.

For example:

```text
priority 1
    ↓
priority 2
    ↓
priority 3
    ↓
priority 4
```

Higher-priority elements receive preference when space becomes constrained.

This is especially important for the intentionally impossible:

```text
1200 × 80
```

surface.

The goal is not to make every element fit at any cost.

The goal is to preserve the most important content and degrade lower-priority content when necessary.

---

# 14. Degradation Cascade

The resolver can move through degradation stages.

Conceptually:

```text
Ideal
  ↓
Shrink
  ↓
Reposition
  ↓
Drop
```

Not every element needs every stage.

For example:

```text
headline
    ideal → shrink

price
    ideal → reposition

logo
    ideal → reposition
```

The final `ResolvedElement` records the actual degradation state.

This makes the resolver's behavior inspectable instead of silently changing the layout.

---

# 15. Shrinking

Text elements can be reduced in size when their ideal geometry cannot accommodate the required content.

The resolver uses minimum text constraints to avoid shrinking text below an acceptable readable size.

This is especially relevant for surfaces with large viewing distances.

The impossible banner demonstrates that the resolver cannot simply keep shrinking text indefinitely.

---

# 16. Repositioning

When the ideal rectangle is unavailable, the resolver can search for another available rectangle.

The free-space search uses the geometry module.

The new rectangle must still satisfy the element's requirements.

This allows lower-priority content to move into leftover space instead of immediately being removed.

---

# 17. Dropping

If an element cannot fit even after the available degradation stages, the resolver can mark it as:

```text
visible = false
```

and:

```text
degradation = "dropped"
```

The element is therefore not clipped into an invalid rectangle.

This distinction is important.

A dropped element is an explicit resolver decision.

It is not a rendering failure.

---

# 18. Equal-Priority Elements

The resolver also handles elements with equal priority.

When two elements have the same priority, declared order becomes the deterministic tiebreak.

For example:

```text
hero-first-declared
hero-second-declared
```

If both want the same ideal region:

```text
hero-first-declared
    ↓
claims ideal rectangle

hero-second-declared
    ↓
cannot overlap
    ↓
searches for free space
```

The stress test demonstrates this behavior using:

```text
200 × 200
```

surface geometry.

The second element is repositioned into remaining space.

---

# 19. Why There Is No Surface Identity Branching

A key requirement is avoiding logic such as:

```ts
if (surface === "mobilePortrait")
```

or:

```ts
switch (surface.id)
```

The resolver instead reasons from:

```text
width
height
aspect ratio
orientation
constraints
roles
priorities
available space
```

This is what makes the unseen-surface test meaningful.

The resolver is not memorizing the five surfaces.

It is using general geometric rules.

---

# 20. Unseen Surface Test

The stress-test script defines an additional surface that is not referenced by:

```text
composition-strategies.ts
```

or:

```text
resolver.ts
```

The surface has its own dimensions:

```text
2400 × 300
```

The same advertisement is resolved against it.

If the resolver successfully produces a layout, this demonstrates that it is responding to surface geometry rather than checking for a known surface ID.

---

# 21. DOM Renderer

## `src/render-dom.ts`

The renderer converts the resolver's output into actual DOM elements.

The renderer does **not** recompute layout.

It directly consumes:

```text
x
y
width
height
```

from `ResolvedElement`.

This separation is intentional.

The resolver answers:

> Where should the element be?

The renderer answers:

> How should that resolved rectangle be painted?

---

# 22. Product Image Rendering

Image elements are rendered using an actual `<img>` element.

The image source comes from the advertisement specification.

The renderer uses:

```text
width: 100%
height: 100%
object-fit: contain
```

so the product image stays inside the rectangle selected by the resolver.

The image itself does not influence the resolver's geometry.

The resolver remains responsible for the image rectangle.

---

# 23. Text Rendering

Text is rendered inside a separate inner element.

This is important because the outer element is used for flex-based centering.

The text itself can use:

```text
-webkit-line-clamp
```

when the resolver specifies a line limit.

Keeping these responsibilities separate prevents flex layout and text clamping from fighting each other.

---

# 24. Scaling the Preview

The demo surface is rendered at its resolved logical dimensions.

The preview then scales to fit the available browser viewport.

Conceptually:

```text
logical surface
       ↓
calculate available browser frame
       ↓
calculate scaleX
       ↓
calculate scaleY
       ↓
use smaller scale
       ↓
render preview
```

This scaling is only a presentation concern.

It does not alter the resolver's geometry.

---

# 25. Demo

The `demo/` directory contains the interactive Vite application.

The demo allows the user to switch between the supported surfaces and observe how the same advertisement is resolved differently.

The UI is intentionally secondary to the resolver.

Its purpose is to make the resolution results visually inspectable.

---

# 26. Stress Test

## `scripts/stress-test.ts`

The stress test is the primary non-browser verification tool.

It exercises four scenarios.

---

## Scenario 1 — Required Surfaces

The same advertisement is resolved against:

```text
Mobile Portrait
Mobile Landscape
Broadcast Lower Third
Retail Kiosk
```

The output demonstrates that the layouts are meaningfully different.

The engine is not simply uniformly scaling one arrangement.

---

## Scenario 2 — Impossible Tight Banner

The test uses:

```text
1200 × 80
```

The surface is deliberately too short to accommodate all ideal element sizes.

The resolver must therefore make a real trade-off.

The output demonstrates an explicit degradation:

```text
headline → dropped
```

while other elements remain placed.

This proves that the resolver can acknowledge an impossible constraint rather than silently clipping content.

---

## Scenario 3 — Unseen Surface

The script defines a surface that does not exist in the composition strategy or resolver source.

The surface is:

```text
2400 × 300
```

The resolver still produces a valid layout.

This demonstrates generalization based on geometry.

---

## Scenario 4 — Equal Priority

Two hero elements deliberately share the same priority and ideal region.

The resolver preserves declared order.

The first element receives the preferred region.

The second element searches for available space and is repositioned.

This demonstrates deterministic conflict resolution.

---

# 27. Verification Commands

Type-check:

```bash
npm run typecheck
```

Run the resolver stress tests:

```bash
npm run stress-test
```

Build the production application:

```bash
npm run build
```

Run the development server:

```bash
npm run dev
```

The project currently passes:

```text
npm run typecheck
npm run stress-test
npm run build
```

The project does not currently define an `npm test` script, so:

```bash
npm test
```

is not a valid project command unless a test script is added to `package.json`.

---

# 28. Current Verified Behavior

The latest stress-test execution verifies:

```text
Mobile Portrait
✓ resolves
✓ headline shrinks
✓ price repositions
✓ logo repositions

Mobile Landscape
✓ resolves cleanly
✓ no degradation

Broadcast Lower Third
✓ resolves cleanly
✓ no degradation

Retail Kiosk
✓ resolves cleanly
✓ no degradation

Impossibly Tight Banner
✓ product image placed
✓ CTA placed
✓ price placed
✓ logo placed
✓ headline explicitly dropped

Unseen Surface
✓ resolves cleanly
✓ no surface-specific resolver branch

Equal Priority
✓ first element keeps ideal region
✓ second element repositions deterministically
```

---

# 29. Browser Compatibility

The renderer uses standard browser APIs, including:

```text
DOM APIs
Canvas 2D text measurement
ResizeObserver
standard CSS
```

The project is intended to work in current:

```text
Chrome
Edge
Firefox
Safari
```

No experimental browser APIs are required by the architecture.

---

# 30. Known Limitations

## Text wrapping

Text wrapping is modeled from measured single-line width and line-height.

It is not a full browser-grade word-breaking engine.

The resolver nevertheless uses measurement to reject boxes that cannot reasonably contain the rendered text.

---

## Free-space search

`findLargestFreeRect()` uses a fixed:

```text
40 × 40
```

grid.

This makes the search deterministic and fast but not pixel-perfect.

The algorithm may occasionally under-report the true largest free rectangle by a few percent.

---

## No global backtracking

The resolver makes one resolution attempt per element at each degradation stage.

It does not perform full global backtracking.

For example, it does not reopen an already placed higher-priority element just to create additional space for a lower-priority element.

This follows the project's priority guarantee:

> Higher-priority elements are never compromised for lower-priority elements.

The trade-off is that the resulting layout is not guaranteed to be globally optimal.

---

## No animation

The demo does not currently animate transitions when switching between surfaces.

Surface changes are rendered directly.

---

# 31. Architectural Guarantees

The project is designed around the following guarantees:

### Single advertisement specification

One `AdSpec` is reused across all surfaces.

### Geometry-driven resolution

Surface dimensions and constraints drive layout decisions.

### No surface-ID branching

The resolver does not contain special-case layout code for named surfaces.

### Priority-aware degradation

Important elements receive preference.

### Explicit degradation

Shrink, reposition, and drop decisions are represented in resolver output.

### Text-aware placement

Text measurement participates in fit decisions.

### Deterministic behavior

Equal-priority conflicts use declared order as the tiebreak.

### Renderer separation

The DOM renderer does not recalculate resolver geometry.

### Unseen-surface generalization

A previously unknown surface can be resolved using the same engine.

---

# 32. File Responsibilities

```text
src/
│
├── types.ts
│   └── Domain types and resolver output types
│
├── spec.ts
│   └── Advertisement definition and validation
│
├── surfaces.ts
│   └── Surface constraints and required profiles
│
├── composition-strategies.ts
│   └── Orientation/aspect-ratio based preferred compositions
│
├── geometry.ts
│   └── Rectangle math and free-space search
│
├── text-measure.ts
│   └── Text measurement and fallback heuristics
│
├── resolver.ts
│   └── Core constraint-resolution algorithm
│
└── render-dom.ts
    └── Resolved layout → DOM rendering

demo/
└── Interactive Vite demonstration

scripts/
└── stress-test.ts
    └── Adversarial and generalization scenarios
```

---

# 33. Design Philosophy

The central design principle is:

> **The layout engine should resolve constraints, not memorize surfaces.**

A surface is not treated as a special case.

Instead, it is represented by measurable constraints.

An advertisement is not manually redesigned for every output.

Instead, the resolver starts with one specification and progressively adapts it according to:

```text
priority
geometry
available space
text measurement
minimum constraints
collision state
degradation rules
```

This makes the system extensible.

Adding another surface should primarily mean providing another set of constraints, rather than adding another branch to the resolver.

---

# 34. Final Architecture Summary

The completed system can therefore be summarized as:

```text
                    ONE AD SPEC
                         │
                         ▼
                ┌────────────────┐
                │    RESOLVER    │
                │                │
                │ constraints    │
                │ priorities     │
                │ geometry       │
                │ text fit       │
                │ degradation    │
                └───────┬────────┘
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
   Mobile          Broadcast         Retail
   Portrait        Lower Third       Kiosk
        │               │                │
        └───────────────┼────────────────┘
                        │
                        ▼
                 UNKNOWN SURFACE
                        │
                        ▼
                 SAME RESOLVER
```

The important result is that the engine does not need to know the name of the output surface.

It receives constraints, resolves them, records any degradation, and hands the resulting geometry to the renderer.
