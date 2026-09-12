# Adaptive Layout Engine for Multi-Surface Ads

A constraint-based layout resolver that takes **one advertisement specification** and automatically adapts it across fundamentally different display surfaces.

The engine does **not** contain surface-specific layout branches such as:

```ts
if (surface === "mobile") {
  ...
}

if (surface === "kiosk") {
  ...
}
````

Instead, the resolver selects a composition strategy from the **geometry and aspect ratio of the surface**, resolves element constraints, protects higher-priority content, and progressively degrades lower-priority elements when space becomes constrained.

---

# 1. Project Goal

The objective of this project is to demonstrate that a single advertisement specification can be rendered across multiple surfaces without creating a separate layout implementation for every screen size.

The same ad contains:

* Product image
* Headline
* Price
* Call-to-action button
* Brand/logo

The resolver decides where these elements should be placed based on:

* Surface dimensions
* Surface aspect ratio
* Element role
* Element priority
* Ideal dimensions
* Minimum dimensions
* Text measurement
* Available free space
* Degradation rules

The system therefore separates:

**What the advertisement contains**

from

**How the advertisement fits a particular surface.**

---

# 2. Core Principle

The advertisement is defined once.

For example:

```ts
const sampleAdSpec = defineAd({
  id: "airpods-pro-promo",
  elements: [
    ...
  ],
});
```

The same specification can then be resolved against completely different surfaces:

```text
320 × 480
480 × 320
1920 × 250
1080 × 1080
1200 × 80
2400 × 300
200 × 200
```

The resolver produces different arrangements for each surface.

No surface identity needs to be hardcoded into the resolver.

---

# 3. Required Surfaces

The project supports the four required surfaces:

| Surface               |  Resolution | Orientation |
| --------------------- | ----------: | ----------- |
| Mobile Portrait       |   320 × 480 | Portrait    |
| Mobile Landscape      |   480 × 320 | Landscape   |
| Broadcast Lower Third |  1920 × 250 | Wide        |
| Retail Kiosk          | 1080 × 1080 | Square      |

In addition, the project includes adversarial and generalization scenarios.

---

# 4. Additional Test Surfaces

## Impossible Tight Banner

```text
1200 × 80
```

This surface is deliberately too short to comfortably contain all elements at their ideal sizes.

The resolver must protect higher-priority content and degrade lower-priority content when necessary.

This demonstrates that the system does not simply clip elements or allow them to overflow.

---

## Unseen Surface

The stress test also defines a surface that is **not registered inside the normal composition strategy configuration**.

The resolver receives only its geometry and determines an appropriate layout from the surface characteristics.

This is important because it demonstrates generalization.

The resolver is not simply matching:

```text
surface name → predefined layout
```

Instead, it uses:

```text
surface geometry → composition strategy → constraint resolution
```

---

## Equal-Priority Conflict

A separate test creates two elements with:

* The same role
* The same priority
* The same ideal region

This demonstrates the deterministic tiebreak rule.

When priorities are equal, the declared element order is preserved.

The first element gets the preferred region.

The second element attempts to use remaining free space and is repositioned or degraded if necessary.

---

# 5. Adaptive Resolution Pipeline

The overall pipeline is:

```text
Ad Specification
       │
       ▼
Surface Geometry
       │
       ▼
Composition Strategy
       │
       ▼
Ideal Element Rectangles
       │
       ▼
Constraint Resolution
       │
       ├── Fits
       │
       ├── Shrink
       │
       ├── Reposition
       │
       └── Drop
       │
       ▼
Resolved Layout
       │
       ▼
DOM Renderer
```

The resolver therefore produces a layout before the browser renderer paints it.

---

# 6. Element Priority

Every element has a priority.

Lower priority numbers represent higher importance.

Example:

```text
priority 1 → highest
priority 2
priority 3
priority 4
priority 5 → lower priority
```

The resolver processes elements according to priority.

Higher-priority elements are protected before lower-priority elements.

This allows the engine to make meaningful decisions when the available surface becomes constrained.

For example:

```text
Headline
    ↓
Price
    ↓
CTA
    ↓
Logo
```

If there is insufficient space, the resolver does not arbitrarily remove content.

It follows the configured priority and degradation rules.

---

# 7. Degradation Model

The resolver supports progressive degradation.

An element can generally go through states such as:

```text
Ideal
  ↓
Shrunk
  ↓
Repositioned
  ↓
Dropped
```

The exact transition depends on the element and the available geometry.

The important property is that degradation is explicit.

The stress-test output reports these decisions.

Example:

```text
headline [shrunk]
price    [repositioned]
logo     [repositioned]
```

This makes the resolver's decisions observable instead of hiding them inside the renderer.

---

# 8. Text-Aware Layout

Text is not treated as an arbitrary rectangle.

The project includes:

```text
src/text-measure.ts
```

This module provides text measurement used by the resolver when determining whether a text element can fit inside a candidate rectangle.

The browser uses Canvas 2D text measurement.

The Node-side stress-test environment uses the documented fallback heuristic.

This allows the resolver to make text-aware fit decisions without requiring a browser for every test.

---

# 9. Geometry Engine

The geometry utilities are contained in:

```text
src/geometry.ts
```

The geometry layer provides rectangle operations used by the resolver.

It is responsible for concepts such as:

* Rectangle intersection
* Rectangle containment
* Free-space calculations
* Candidate placement
* Largest available free rectangle

The free-space finder is used when an element cannot remain in its ideal position and needs to be repositioned.

---

# 10. Composition Strategies

Composition strategies are contained in:

```text
src/composition-strategies.ts
```

The strategies describe how different surface orientations should initially arrange the semantic roles.

The strategy layer is intentionally separated from the constraint resolver.

This means:

```text
Composition strategy
        +
Surface geometry
        +
Ad specification
        ↓
Resolver
```

The strategy provides a good initial arrangement.

The resolver is responsible for making that arrangement actually fit.

---

# 11. Constraint Resolver

The core algorithm is implemented in:

```text
src/resolver.ts
```

The resolver:

1. Receives an ad specification.
2. Receives a surface.
3. Selects a composition strategy based on geometry.
4. Calculates ideal element rectangles.
5. Orders elements according to priority.
6. Checks whether each element fits.
7. Attempts degradation when necessary.
8. Searches for remaining free space when repositioning is required.
9. Drops an element only when it cannot be accommodated.
10. Returns a resolved layout.

The renderer does not make these layout decisions.

---

# 12. DOM Renderer

The resolved layout is rendered by:

```text
src/render-dom.ts
```

The renderer receives the already-resolved geometry:

```text
x
y
width
height
```

and applies it directly to DOM elements.

The renderer therefore does not independently calculate the layout.

Its responsibility is to:

* Create DOM elements
* Apply resolved geometry
* Render text
* Render buttons
* Render product images
* Apply visual degradation indicators
* Scale the preview to the available browser frame

This separation prevents the renderer from silently changing resolver decisions.

---

# 13. Product Image

The demo includes a product image asset.

The image is loaded from the public asset path used by the demo.

The resolver still determines:

```text
x
y
width
height
```

The DOM renderer simply places the image inside that resolved rectangle.

This preserves the architecture:

```text
Resolver → geometry
Renderer → pixels
```

---

# 14. Interactive Demo

The project includes an interactive demo under:

```text
demo/
```

The demo allows the user to switch between the available surfaces.

This makes it possible to visually inspect how the same advertisement changes across different aspect ratios.

The demo also exposes the resolution decisions so that changes such as:

```text
shrunk
repositioned
dropped
```

can be observed.

---

# 15. Project Structure

```text
adaptive-layout-engine/
│
├── src/
│   ├── types.ts
│   ├── spec.ts
│   ├── surfaces.ts
│   ├── composition-strategies.ts
│   ├── resolver.ts
│   ├── geometry.ts
│   ├── text-measure.ts
│   ├── render-dom.ts
│   └── index.ts
│
├── demo/
│   └── ...
│
├── scripts/
│   └── stress-test.ts
│
├── public/
│   └── image.png
│
├── ARCHITECTURE.md
├── README.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

# 16. Important Source Files

## `src/types.ts`

Defines the core type system.

It contains the contracts for:

* Advertisement specifications
* Advertisement elements
* Surface definitions
* Element roles
* Resolved elements
* Resolved layouts
* Degradation states

---

## `src/spec.ts`

Contains:

```ts
defineAd()
```

This validates advertisement specifications before they enter the resolver.

Validation includes:

* Duplicate element IDs
* Invalid roles
* Invalid priorities
* Invalid image aspect ratios
* Missing text/button content
* Empty specifications

It also provides convenience constructors:

```ts
text()
image()
button()
```

---

## `src/surfaces.ts`

Contains:

```ts
defineSurface()
```

and the required surface definitions.

The surface describes geometry rather than containing advertisement-specific layout logic.

---

## `src/composition-strategies.ts`

Contains the orientation-aware composition strategies.

The important architectural rule is that the resolver should not contain code such as:

```ts
if (surface.name === "Mobile Portrait")
```

or:

```ts
if (surface.name === "Retail Kiosk")
```

The system should reason from geometry and semantic roles instead.

---

## `src/resolver.ts`

Contains the main constraint-resolution algorithm.

This is the central component of the project.

---

## `src/geometry.ts`

Contains rectangle and free-space calculations.

It supports repositioning when an element cannot remain in its ideal location.

---

## `src/text-measure.ts`

Contains text measurement functionality.

Browser execution uses Canvas 2D measurement.

Node execution uses the documented fallback.

---

## `src/render-dom.ts`

Converts the resolved layout into actual DOM elements.

It does not replace the resolver's geometry with a second layout algorithm.

---

## `scripts/stress-test.ts`

Contains deterministic adversarial scenarios used to verify the resolver.

This is one of the most important files for demonstrating that the system actually works.

---

# 17. Installation

Clone the repository and install dependencies:

```bash
npm install
```

---

# 18. Run the Demo

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite.

Typically:

```text
http://localhost:5173
```

Use the surface selector to switch between the different surfaces.

---

# 19. Type Check

Run:

```bash
npm run typecheck
```

A successful result should finish without TypeScript errors.

Current project status:

```text
TypeScript typecheck: PASS
```

---

# 20. Production Build

Run:

```bash
npm run build
```

This performs the TypeScript check and creates the Vite production bundle.

A successful build confirms that the project can be compiled for production.

Current project status:

```text
Production build: PASS
```

---

# 21. Stress Test

Run:

```bash
npm run stress-test
```

The stress test runs without requiring the browser.

It validates four major behaviors.

---

## Scenario 1 — Required Surfaces

The same advertisement specification is resolved against:

```text
Mobile Portrait
Mobile Landscape
Broadcast Lower Third
Retail Kiosk
```

The layouts are meaningfully different.

The engine is not simply uniformly scaling one fixed layout.

For example, the current stress-test output demonstrates:

```text
Mobile Portrait
    headline → shrunk
    price    → repositioned
    logo     → repositioned

Mobile Landscape
    all elements → fit cleanly

Broadcast Lower Third
    all elements → fit cleanly

Retail Kiosk
    all elements → fit cleanly
```

---

# 22. Scenario 2 — Impossible Banner

The stress test uses:

```text
1200 × 80
```

The surface is intentionally extremely short.

The resolver must deal with a genuine constraint conflict.

The current result demonstrates an actual degradation:

```text
headline → dropped
```

while the remaining elements are placed within the available geometry.

The important point is that the headline is not simply clipped by the browser.

The resolver explicitly reports:

```text
dropped
```

because there is no suitable remaining space after higher-priority placement decisions.

---

# 23. Scenario 3 — Unseen Surface

The stress test defines an additional surface only inside the test script.

It is not added as a special case to:

```text
composition-strategies.ts
```

or:

```text
resolver.ts
```

The resolver still produces a valid layout.

This demonstrates that the system can generalize to a surface it was not explicitly configured for.

The key design principle is:

```text
Surface geometry
        ↓
Aspect ratio / orientation
        ↓
Strategy
        ↓
Constraint resolution
```

rather than:

```text
Surface name
        ↓
Hardcoded layout
```

---

# 24. Scenario 4 — Equal Priority

The stress test creates two elements with the same priority and the same ideal region.

The resolver uses declared order as the deterministic tiebreak.

The first element gets the preferred rectangle.

The second element searches for available free space.

The current result demonstrates:

```text
hero-first-declared
    → ideal placement

hero-second-declared
    → repositioned
```

This proves that the resolver handles conflicts deterministically.

---

# 25. Current Verification

The project has currently passed:

```text
✓ npm run typecheck
✓ npm run stress-test
✓ npm run build
```

The stress test currently verifies:

```text
✓ Mobile Portrait
✓ Mobile Landscape
✓ Broadcast Lower Third
✓ Retail Kiosk
✓ Impossible Tight Banner
✓ Unseen Surface
✓ Equal-Priority Conflict
```

The interactive demo has also been manually verified across the available surfaces.

---

# 26. Browser Compatibility

The implementation uses standard browser APIs.

The project relies primarily on:

* DOM APIs
* Canvas 2D text measurement
* ResizeObserver
* Standard CSS
* TypeScript
* Vite

It does not require experimental browser APIs.

The intended target is current versions of:

```text
Chrome
Edge
Firefox
Safari
```

---

# 27. Architecture Guarantees

The implementation is designed around several important guarantees.

## One Ad Specification

The advertisement is defined once.

The same specification is reused across every surface.

---

## No Surface-Identity Branching

The resolver should not contain surface-specific code such as:

```ts
if (surface === "Mobile Portrait")
```

The layout decision is based on surface geometry and semantic composition.

---

## Priority Preservation

Higher-priority content is protected before lower-priority content.

---

## Explicit Degradation

The resolver reports whether content was:

```text
placed
shrunk
repositioned
dropped
```

rather than silently allowing overflow.

---

## Deterministic Resolution

Given the same:

```text
Ad specification
+
Surface
+
Resolver configuration
```

the resolver produces deterministic output.

---

# 28. Known Limitations

## Text Wrapping

Text wrapping is modeled using measured single-line width and line height.

It is not intended to reproduce the full browser word-breaking algorithm.

The resolver nevertheless uses text measurement when making fit decisions so that it does not knowingly create boxes that are obviously too small for their content.

---

## Free-Space Search

The current:

```text
findLargestFreeRect
```

implementation uses a fixed:

```text
40 × 40
```

grid.

This makes the search:

* Fast
* Deterministic
* Simple

However, it is not pixel-perfect.

The calculated largest free rectangle can occasionally be slightly smaller than the mathematically optimal rectangle.

---

## No Global Backtracking

The resolver performs one resolution attempt per element at each degradation stage.

It does not perform unrestricted global backtracking.

For example, it does not repeatedly move a previously placed higher-priority element solely to optimize the position of a lower-priority element.

This is intentional because the system prioritizes the guarantee that higher-priority elements are not compromised by lower-priority content.

---

## No Animation

The demo currently switches between surfaces without animation or transition effects.

Animation is outside the core layout-resolution problem.

---

# 29. Why This Is More Than a Responsive UI

A normal responsive implementation might contain separate rules such as:

```text
mobile CSS
tablet CSS
desktop CSS
kiosk CSS
broadcast CSS
```

This project takes a different approach.

The system has:

```text
Advertisement semantics
        +
Surface constraints
        +
Composition strategy
        +
Resolution algorithm
```

The final position is calculated rather than manually authored for every surface.

This makes the system suitable for testing new surface geometries without adding a new layout branch for every resolution.

---

# 30. Example Resolution Lifecycle

Consider a headline.

The resolver may initially calculate:

```text
Ideal rectangle
```

If that rectangle fits:

```text
IDEAL
```

If the ideal rectangle is too large:

```text
SHRINK
```

If shrinking cannot solve the collision:

```text
REPOSITION
```

If no acceptable rectangle remains:

```text
DROP
```

The final resolved state is then passed to the DOM renderer.

---

# 31. Separation of Responsibilities

The project intentionally separates responsibilities.

```text
types.ts
    ↓
Data contracts

spec.ts
    ↓
Ad validation

surfaces.ts
    ↓
Surface definitions

composition-strategies.ts
    ↓
Initial composition

geometry.ts
    ↓
Rectangle mathematics

text-measure.ts
    ↓
Text fit information

resolver.ts
    ↓
Constraint resolution

render-dom.ts
    ↓
Browser rendering

stress-test.ts
    ↓
Adversarial verification
```

This makes the core algorithm easier to reason about and test independently from the UI.

---

# 32. Development Workflow

Recommended workflow:

```bash
npm install
```

Then:

```bash
npm run typecheck
```

Then:

```bash
npm run stress-test
```

Then:

```bash
npm run build
```

Finally:

```bash
npm run dev
```

This verifies the project in the following order:

```text
Type correctness
       ↓
Algorithm correctness
       ↓
Production compilation
       ↓
Visual verification
```

---

# 33. AI Tool Disclosure

This project was developed with Claude as a pair-programming collaborator.

AI assistance was used during development for areas including:

* Resolver algorithm design
* Composition strategy design
* Debugging
* Test scenario design
* Demo implementation
* Documentation

The implementation was manually reviewed and tested.

The stress-test scenarios are executed against the actual resolver rather than being hypothetical examples.

---

# 34. Final Status

The Adaptive Layout Engine currently provides:

```text
✓ One advertisement specification
✓ Four required surfaces
✓ Additional unseen surface
✓ Impossible tight-banner test
✓ Equal-priority conflict test
✓ Geometry-based resolution
✓ Priority-aware degradation
✓ Shrink behavior
✓ Reposition behavior
✓ Drop behavior
✓ Text-aware fitting
✓ Free-space search
✓ DOM rendering
✓ Product image rendering
✓ Interactive demo
✓ TypeScript type checking
✓ Production build
✓ Automated stress test
```

The project is ready for final repository submission and demonstration.

---

# 35. Commands Summary

Install dependencies:

```bash
npm install
```

Start demo:

```bash
npm run dev
```

Type check:

```bash
npm run typecheck
```

Run resolver stress tests:

```bash
npm run stress-test
```

Build production bundle:

```bash
npm run build
```

---

# 36. Important Note About `npm test`

The project currently does not define an `npm test` script.

Therefore:

```bash
npm test
```

is not required for the current project configuration.

The project's dedicated automated resolver verification command is:

```bash
npm run stress-test
```

The commands that currently pass are:

```text
npm run typecheck
npm run stress-test
npm run build
```

---

# 37. Git Submission

Before pushing the final version, check:

```bash
git status
```

Then:

```bash
git add .
git commit -m "Finalize adaptive layout engine"
git push origin main
```

After pushing, verify:

```bash
git status
```

Expected result:

```text
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

---

# Conclusion

The Adaptive Layout Engine demonstrates a constraint-based approach to multi-surface advertisement rendering.

Instead of maintaining a separate layout for every device or display, the system defines the advertisement once and resolves its placement against the constraints of each surface.

The key architectural idea is:

```text
ONE AD SPEC
     ↓
SURFACE GEOMETRY
     ↓
COMPOSITION STRATEGY
     ↓
CONSTRAINT RESOLUTION
     ↓
DEGRADATION
     ↓
RESOLVED LAYOUT
     ↓
DOM RENDERING
```

The result is a deterministic, testable and extensible layout engine capable of handling both known and previously unseen surface geometries.

````
