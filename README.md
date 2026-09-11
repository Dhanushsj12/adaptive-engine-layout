# Adaptive Layout Engine for Multi-Surface Ads

A constraint-based layout resolver that takes **one** ad specification and
adapts it across fundamentally different surfaces — a tall mobile
interstitial, a wide broadcast lower-third, a square retail kiosk, and any
surface it has never seen before — without a single `if (surface === "x")`
branch.

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`). Use the
surface list on the left to switch between the 4 required profiles, an
intentionally brutal stress-test surface, and a 5th "unseen" profile that
exists only in the demo code, to prove the resolver generalizes.

To type-check the whole project:

```bash
npm run typecheck
```

To build a production bundle:

```bash
npm run build
```

## Proving it actually works (read this before the demo)

The interesting part of this project isn't the UI — it's whether the
resolver is honest. Run:

```bash
npm run stress-test
```

This prints, without a browser, four scenarios:

1. The same ad spec resolved against all 4 required surfaces, showing
   meaningfully different arrangements (not uniform scaling).
2. A deliberately brutal 1200×80 strip where the far-viewing-distance
   minimum text size forces a real conflict between two elements — showing
   an actual drop, not just a clipped edge.
3. A surface defined **only inside that script**, never referenced in
   `composition-strategies.ts` or `resolver.ts`, to demonstrate the
   resolver generalizes by aspect ratio, not by surface identity.
4. Two elements that deliberately share the same role (and therefore the
   same ideal rect) to show how the tiebreak and degradation cascade
   behave when templates alone can't resolve a conflict.

Every number in that output is real resolver output at the time this
project was built — see `ARCHITECTURE.md` for exactly how each scenario
was constructed and why it's a genuine test, not a cherry-picked one.

## What's included

- `src/types.ts` — the type system (see ARCHITECTURE.md for why each field exists)
- `src/spec.ts` — `defineAd()`, with validation at construction time
- `src/surfaces.ts` — `defineSurface()` + the 4 required profiles
- `src/composition-strategies.ts` — the per-orientation layout templates
- `src/resolver.ts` — the actual constraint-resolution algorithm
- `src/geometry.ts` — rectangle math + the free-space finder used for "reposition"
- `src/text-measure.ts` — real canvas text measurement in the browser, a documented heuristic fallback in Node; used for text-aware fit decisions
- `src/render-dom.ts` — paints a resolved layout to real DOM elements
- `demo/` — the interactive surface-picker demo (Vite + vanilla TypeScript)
- `scripts/stress-test.ts` — the adversarial test runs described above

## Browser compatibility

Tested against current Chrome/Edge/Firefox/Safari. Uses only standard
Canvas 2D text measurement and DOM APIs — no experimental features.

## Known limitations

- Text wrapping is modeled from measured single-line width and line-height;
  it is not a browser-grade word-breaking engine. The resolver nevertheless
  uses the measurement to reject boxes that cannot contain the rendered text,
  so the DOM renderer does not knowingly clip text.
- The free-space search (`findLargestFreeRect`) uses a fixed 40×40 grid,
  which is fast and deterministic but not pixel-exact; it can occasionally
  under-report the true largest free rectangle by a few percent.
- Only one resolution attempt per element is made per degradation stage —
  there's no backtracking that would re-open an already-placed
  higher-priority element to make room for a lower-priority one that
  didn't fit. This matches the assignment's own priority guarantee
  ("higher-priority elements are never compromised"), but it does mean
  the algorithm doesn't search for a globally optimal packing.
- No animation/transition when switching surfaces in the demo.

## AI tool disclosure

This project was built with Claude as a pair-programming collaborator,
including the resolver algorithm design, the composition templates, and
the demo. Every stress-test scenario in `scripts/stress-test.ts` was
actually executed against the real resolver during development — the
numbers in this README are not hypothetical.
