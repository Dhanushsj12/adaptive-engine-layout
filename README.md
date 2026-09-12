````markdown
# Adaptive Layout Engine for Multi-Surface Ads

A constraint-based layout resolver that takes **one ad specification** and adapts it across fundamentally different surfaces — a tall mobile interstitial, a wide broadcast lower-third, a square retail kiosk, and surfaces it has never seen before — without a single `if (surface === "x")` branch.

## Setup

```bash
npm install
npm run dev
````

Open the printed local URL (typically `http://localhost:5173`).

Use the surface selector to switch between:

* Mobile Portrait — `320×480`
* Mobile Landscape — `480×320`
* Broadcast Lower Third — `1920×250`
* Retail Kiosk — `1080×1080`
* Unseen Print-to-Digital QR Panel — `600×900`
* Impossible Tight Banner — `1200×80`

The same advertisement specification is resolved independently for every surface.

---

## Core Design

The central idea is to separate **what an advertisement contains** from **where it is rendered**.

The ad specification defines the content and intent:

* element identity
* semantic role
* priority
* content
* element type
* image aspect ratio

The surface specification defines only physical constraints:

* width
* height
* safe-area insets
* viewing distance
* minimum readable text size
* surface metadata

The resolver combines these inputs and produces a concrete layout.

The renderer then paints that resolved layout into the browser DOM.

This separation means the rendering layer does not decide where elements should go, and the ad specification does not contain surface-specific coordinates.

---

## Architecture

```text
                         ┌─────────────────────┐
                         │      AdSpec         │
                         │                     │
                         │ headline            │
                         │ product image       │
                         │ price               │
                         │ CTA                 │
                         │ logo                │
                         └──────────┬──────────┘
                                    │
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │      Surface       │
                         │                     │
                         │ width / height     │
                         │ safe area           │
                         │ viewing distance    │
                         │ text constraints    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │      Resolver      │
                         │                     │
                         │ strategy selection  │
                         │ geometry            │
                         │ text measurement    │
                         │ collision checking  │
                         │ degradation         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   ResolvedLayout    │
                         │                     │
                         │ x / y               │
                         │ width / height      │
                         │ font size           │
                         │ visibility          │
                         │ degradation state   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    DOM Renderer     │
                         │                     │
                         │ browser elements    │
                         │ image rendering     │
                         │ text rendering      │
                         │ buttons             │
                         └─────────────────────┘
```

---

# Project Structure

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
│   ├── index.html
│   └── main.ts
│
├── public/
│   └── image.png
│
├── scripts/
│   └── stress-test.ts
│
├── ARCHITECTURE.md
├── README.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

# 1. `src/types.ts`

This file defines the domain model used by the complete engine.

The important distinction is between:

* **input types** — what the author specifies
* **resolved types** — what the resolver calculates

The resolver therefore becomes the boundary between intent and concrete geometry.

---

# 2. `src/spec.ts`

`defineAd()` validates advertisement specifications when they are created.

Validation includes:

* duplicate element IDs
* invalid roles
* invalid priorities
* invalid image aspect ratios
* missing text/button content
* empty specifications

This prevents invalid data from reaching the resolver.

The file also provides the convenience constructors:

```ts
text(...)
image(...)
button(...)
```

The product image is supplied to the renderer through the image element's content/path.

---

# 3. `src/surfaces.ts`

This file defines the surface model.

The required surfaces are:

| Surface               |        Size |
| --------------------- | ----------: |
| Mobile Portrait       |   `320×480` |
| Mobile Landscape      |   `480×320` |
| Broadcast Lower Third |  `1920×250` |
| Retail Kiosk          | `1080×1080` |

The demo also exposes:

| Surface                          |      Size |
| -------------------------------- | --------: |
| Unseen Print-to-Digital QR Panel | `600×900` |
| Impossible Tight Banner          | `1200×80` |

The important architectural property is that the resolver does not need a surface ID to decide its layout.

---

# 4. `src/composition-strategies.ts`

This module contains the geometric composition strategies.

Strategies are selected from surface characteristics such as orientation and aspect ratio rather than explicit surface identity.

For example, a tall surface can receive a vertically oriented composition while a wide surface can receive a horizontal composition.

The strategies provide **ideal rectangles**.

They do not directly render elements and do not perform the final collision/degradation decision.

This keeps composition intent separate from constraint resolution.

---

# 5. `src/geometry.ts`

This module contains reusable rectangle operations.

It is responsible for operations such as:

* rectangle intersection
* containment
* free-space detection
* candidate rectangle evaluation
* searching for available regions

The free-space search is used when an element cannot remain in its ideal rectangle but can still be placed elsewhere.

This is what enables the resolver to report:

```text
repositioned
```

instead of simply clipping the element.

---

# 6. `src/text-measure.ts`

Text is treated as a real layout constraint.

The browser uses Canvas 2D text measurement to determine the approximate width required by text.

The Node stress-test environment uses the documented fallback heuristic because a browser canvas is not available there.

The measured dimensions are then used by the resolver when deciding whether a text element can fit inside a candidate rectangle.

This prevents the layout engine from knowingly assigning text a rectangle that cannot reasonably contain it.

---

# 7. `src/resolver.ts`

This is the core of the project.

The resolver takes:

```text
AdSpec + Surface
```

and produces:

```text
ResolvedLayout
```

The general process is:

```text
1. Select a composition strategy.
2. Generate ideal rectangles.
3. Order elements according to priority.
4. Evaluate the ideal rectangle.
5. Measure text where necessary.
6. Check safe-area and geometry constraints.
7. Attempt degradation if the ideal placement fails.
8. Search for free space when repositioning is possible.
9. Drop the element only when no valid placement remains.
10. Return the final resolved layout.
```

Priority is significant.

A higher-priority element must not be compromised simply to preserve a lower-priority element.

The resolver therefore records degradation explicitly rather than silently clipping content.

Possible states include:

```text
none
shrunk
repositioned
dropped
```

---

# 8. `src/render-dom.ts`

The DOM renderer consumes the `ResolvedLayout`.

It does **not** recalculate the layout.

The resolver owns:

```text
x
y
width
height
fontSize
visibility
degradation
```

The renderer simply turns those resolved values into DOM elements.

For the product image, the renderer creates an actual `<img>` element and loads:

```text
/image.png
```

The image uses:

```css
object-fit: contain;
object-position: center;
```

so the product artwork remains visible inside the resolver-assigned rectangle.

Text and buttons are rendered separately from their outer layout boxes so text clamping does not interfere with flex-based centering.

The browser preview is additionally scaled to fit the available demo frame without changing the underlying resolver geometry.

---

# 9. Demo

The demo provides an interactive way to inspect the same ad specification across multiple surfaces.

The user can switch between the required surfaces and the adversarial/generalization cases.

The important point is that changing the surface does not change the advertisement specification.

Instead:

```text
same AdSpec
     +
different Surface
     ↓
different ResolvedLayout
```

This demonstrates that the system is adaptive rather than a collection of manually positioned advertisements.

---

# 10. Stress Test

Run:

```bash
npm run stress-test
```

The stress test exercises four important behaviors.

## Scenario 1 — Required surfaces

The same advertisement is resolved against:

```text
Mobile Portrait
Mobile Landscape
Broadcast Lower Third
Retail Kiosk
```

The output demonstrates that the arrangements are meaningfully different rather than simple uniform scaling.

The current resolver output includes:

### Mobile Portrait

```text
headline       shrunk
product-image  none
cta            none
price          repositioned
logo           repositioned
```

### Mobile Landscape

```text
headline       none
product-image  none
cta            none
price          none
logo           none
```

### Broadcast Lower Third

```text
headline       none
product-image  none
cta            none
price          none
logo           none
```

### Retail Kiosk

```text
headline       none
product-image  none
cta            none
price          none
logo           none
```

The Mobile Portrait case demonstrates controlled degradation while the other required surfaces fit cleanly.

---

# 11. Impossible Tight Banner

The stress-test surface is:

```text
1200×80
```

This surface is intentionally too short.

The resolver must protect higher-priority constraints rather than simply clipping content.

The current result demonstrates an actual degradation:

```text
headline       dropped
product-image  none
cta            none
price          none
logo           none
```

The important property is that the headline is explicitly marked as dropped.

It is not merely overflowing outside the surface.

---

# 12. Unseen Surface Generalization

The stress test also defines a surface that does not exist in the normal composition configuration.

The purpose is to verify that the resolver can operate on an unfamiliar surface using its geometric characteristics.

The test surface is:

```text
2400×300
```

It is not referenced by surface identity inside the resolver.

The resolver selects an appropriate strategy from the surface geometry/aspect ratio and produces a valid layout.

This is the key evidence that the engine is not simply a lookup table of:

```text
surface ID → hardcoded coordinates
```

---

# 13. Equal-Priority Conflict

The stress test creates two hero elements with:

```text
priority = 1
```

and the same ideal region.

The expected behavior is deterministic.

The first declared element wins the ideal rectangle.

The second element searches for remaining free space.

The current result is:

```text
hero-first-declared   none
hero-second-declared  repositioned
```

Therefore declaration order acts as the deterministic tiebreak when priority is equal.

---

# 14. No Surface-Specific Resolver Branches

A core requirement is avoiding logic such as:

```ts
if (surface.id === "mobile") {
   ...
}

if (surface.id === "kiosk") {
   ...
}

if (surface.id === "broadcast") {
   ...
}
```

The resolver instead reasons from:

```text
width
height
aspect ratio
safe area
viewing distance
text constraints
element priority
element role
ideal geometry
available space
```

This makes the engine reusable for surfaces that were not known when the code was written.

---

# 15. Browser Compatibility

The demo uses standard browser APIs:

* DOM APIs
* Canvas 2D text measurement
* ResizeObserver
* standard CSS
* standard TypeScript/JavaScript

No experimental browser APIs are required.

The project is intended to work with current:

* Chrome
* Edge
* Firefox
* Safari

---

# 16. Validation and Verification

Run the following commands before submitting:

```bash
npm run typecheck
```

This verifies TypeScript correctness.

Then:

```bash
npm run stress-test
```

This verifies the resolver behavior and adversarial scenarios.

Finally:

```bash
npm run build
```

This verifies that the project can be compiled into a production Vite bundle.

The project currently passes:

```text
npm run typecheck
✓

npm run stress-test
✓

npm run build
✓
```

There is currently no `npm test` script in `package.json`, so `npm test` should not be used unless a test script is added separately.

---

# 17. Known Limitations

## Text wrapping

Text wrapping is modeled using measured single-line width and line-height.

It is not intended to reproduce every browser word-breaking behavior.

The resolver nevertheless uses its measurements to avoid knowingly assigning text to an insufficient rectangle.

## Free-space search

`findLargestFreeRect` uses a deterministic `40×40` grid.

This keeps the search predictable and inexpensive but means the result is not guaranteed to be pixel-optimal.

It may occasionally under-report the mathematically largest available rectangle.

## No global backtracking

The resolver makes one resolution attempt per element at each degradation stage.

It does not completely backtrack through every previous placement to find a globally optimal packing.

This is intentional because higher-priority elements must remain protected.

## Demo transitions

The demo does not currently animate layout changes when switching surfaces.

---

# 18. AI Tool Disclosure

This project was developed with AI-assisted pair programming.

AI assistance was used during development for:

* resolver algorithm design
* composition strategy design
* implementation assistance
* debugging
* stress-test design
* documentation

The implementation was manually reviewed and tested during development.

The stress-test scenarios are executed against the actual resolver rather than being hypothetical examples.

---

# 19. Recommended Verification Workflow

From the project root:

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

Finally run the interactive demo:

```bash
npm run dev
```

Open the displayed local URL and inspect every surface.

---

# 20. What This Project Demonstrates

The project demonstrates a complete adaptive-layout pipeline:

```text
Single advertisement specification
            ↓
Surface-independent intent
            ↓
Geometry-based strategy selection
            ↓
Constraint resolution
            ↓
Priority-aware degradation
            ↓
Collision/free-space handling
            ↓
Resolved coordinates
            ↓
Real DOM rendering
```

The main engineering goal is therefore not simply to produce six visually different advertisements.

It is to demonstrate that **one content specification can be resolved dynamically across fundamentally different surfaces without embedding the surface identity into the resolver algorithm.**

That separation is what makes the layout engine adaptive and extensible.

```
```
