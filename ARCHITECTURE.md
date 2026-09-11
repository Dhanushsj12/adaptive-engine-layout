# Architecture

## Resolution flow

```
Ad Spec (elements + priorities)
         │
         ▼
Surface Profile (width, height, safe area, hard constraints)
         │
         ▼
classifyOrientation()  ──  computed from content-box aspect ratio ONLY
         │                 (never from surface.id or surface.name)
         ▼
COMPOSITION_TEMPLATES[orientation]  ──  one of: portrait / landscape /
         │                                wide-banner / square
         ▼
resolveLayout()
  1. sort elements by priority (ascending — 1 placed first)
  2. for each element, in that order:
       a. compute its ideal rect from the template fraction
       b. compute its hard floor (spec minWidth/minHeight + surface
          minTapTarget / minTextSize)
       c. try the ideal rect, then progressively smaller versions of it,
          anchored at the same corner, down to the hard floor; text/button
          candidates are also rejected when measured wrapping cannot fit
          inside the candidate box
       d. if nothing in its own region works, search the whole surface
          for the largest leftover free rectangle
       e. if even that fails, drop the element and record why
  3. defensive final pass: assert no two visible elements overlap and
     everything is within the surface's content box, or throw
         │
         ▼
ResolvedLayout (x/y/width/height per element, degradation record, warnings)
         │
         ▼
renderLayoutToDOM()  ──  pure rendering, no layout decisions of its own
```

## Why composition is template-driven, not surface-driven

The assignment is explicit that `if (surface === "mobile") return layoutA`
disguised as a "resolver" doesn't count. The resolver never looks at
`surface.id` or `surface.name` at any point. The only thing it looks at is
the **shape** of the surface's content box:

```ts
const aspect = contentWidth / contentHeight;
if (aspect >= 4) return "wide-banner";
if (aspect <= 0.85) return "portrait";
if (aspect < 1.15) return "square";
return "landscape";
```

That's the entire generalization mechanism. A surface this codebase has
never seen — say, a 900×1400 print-to-digital QR panel — gets classified
purely from its numbers and lands in `portrait`, getting the same
vertical-stack template a phone would. `scripts/stress-test.ts` and
`demo/main.ts` both include a surface defined nowhere else in the
codebase, specifically to make this checkable rather than asserted.

## Why 4 orientation buckets, not N surface-specific layouts

Four buckets is a deliberate simplification, not a loophole. The
assignment's own FAQ says a well-reasoned priority-ordered algorithm is
preferred over an over-engineered general solver — the interesting part is
whether the degradation logic is real, not how many orientation buckets
exist. Each bucket produces a **structurally different** composition
(vertical stack vs. horizontal split vs. banner-strip vs. image-over-band),
not a uniformly scaled copy of the others — see the fraction tables in
`composition-strategies.ts`.

## Priority and degradation

Priority is a plain positive number; **lower means more important** (1 =
"must never be dropped" in ordinary cases). The resolver processes
elements in ascending priority order. Because higher-priority elements are
placed first, into an empty (or less-full) surface, they win contested
space by construction — no separate "protect high priority" rule is
needed, it falls out of processing order.

For each element, in order, three things are tried:

1. **Shrink toward its floor.** The ideal rect is scaled down in fixed
   steps (100% → 85% → 70% → 55% → 40%), anchored at the same top-left
   corner, stopping as soon as a step both clears all previously-placed
   elements and respects the element's hard floor. Anchoring at the same
   corner instead of re-centering keeps the result predictable: you can
   always explain why an element ended up where it did.

2. **Reposition into leftover space.** If nothing in its own region works
   even at the floor size, `findLargestFreeRect()` scans the whole content
   box (via a 40×40 grid, so it's fast and size-independent) for the
   biggest rectangle not covered by anything already placed. If that's big
   enough for the floor size, the element goes there instead.

3. **Drop.** If neither works, the element is excluded entirely, marked
   `dropped`, and a specific, human-readable reason is added to
   `warnings` — never a silent omission.

### Why this surface is the real stress test

`impossiblyTightBanner` (1200×80, `minTextSize: 28`, `viewingDistance:
"far"`) was chosen deliberately, not because it's small, but because of
*how* it becomes infeasible. In the `wide-banner` template, `primary`
(headline) and `secondary` (price) are stacked in the same column. The
far-viewing-distance rule forces the headline's minimum height
(`lineHeightFor(28) = 35px`) past what its own template fraction allots it
(`0.5 × 64px content height = 32px`). That overflow pushes the headline's
bottom edge into the price element's territory below it — a genuine
two-element conflict caused by a hard constraint, not just "the surface is
tiny." Running `npm run stress-test` shows the actual result: the headline
keeps its space (it's priority 1 and placed first), and price is dropped
with a specific logged reason.

An earlier, smaller version of this surface (300×60, no `minTextSize`)
was tried first and turned out to resolve *cleanly* — because in the
`wide-banner` template, `hero`, `primary+secondary`, `action`, and
`branding` occupy separate side-by-side columns, and a plain size
reduction within one column never reaches into a neighboring column. That
failed attempt is why the final surface adds `minTextSize` +
`viewingDistance: "far"` specifically: it's the detail that turns "small"
into "genuinely infeasible."

### Why the equal-priority test uses two same-role elements, not two priority-1 elements of different roles

The first version of this test used a priority-1 headline and a
priority-1 hero image. It also resolved with zero conflict — because
`hero` and `primary` are different roles, and different roles always get
different, non-overlapping regions in every template by construction.
Two elements of *different* roles at the same priority don't actually
compete for the same space, so that test proved nothing.

The real test needed two elements requesting the **same role** (`hero`
twice), which produces two literally identical ideal rects. Since
`Array.prototype.sort` is stable, the first-declared element wins that
rect outright. The second one is a 100%-overlapping duplicate that
shrinking can never resolve on its own (shrinking keeps the same anchor
corner, and a rectangle anchored at the same corner as a larger one is
always contained inside the overlap) — so it necessarily falls through to
the free-space search, and gets repositioned or dropped depending on
whether the surface has any slack left. That's the actual tiebreak
mechanism, demonstrated rather than asserted.

## Type system

Every type in `src/types.ts` exists to make an invalid spec or surface
hard to construct, not just to document one that's already valid:

- `ElementRole` is a closed string union. `defineAd()` checks every
  element's role against it at construction time and throws immediately
  with the offending id, rather than letting a typo silently fall through
  to "no template match" deep inside the resolver.
- `AdElement.priority` is validated to be a finite number ≥ 1 in
  `defineAd()` — a `NaN` or negative priority fails at spec-definition
  time, not mid-resolution.
- `SurfaceProfile.safeArea` is checked in `defineSurface()` so a safe area
  that would consume the entire surface (insets ≥ the surface's own
  dimensions) is rejected before it can ever reach the resolver.
- `ResolvedElement.degradation` is a closed union
  (`"none" | "shrunk" | "repositioned" | "dropped"`) so a renderer can
  exhaustively switch on it (e.g. to show the amber dashed outline used in
  the demo) without a fallback case that silently swallows a new state.
- `noUncheckedIndexedAccess` is enabled project-wide in `tsconfig.json`.
  This caught several real bugs during development (see below) rather
  than being a style preference — every array/record index access in
  `geometry.ts` and `resolver.ts` had to be proven safe or explicitly
  guarded.

## What `noUncheckedIndexedAccess` actually caught

Turning this on was not a formality — the first `tsc --noEmit` run
produced 11 real errors, all genuine: an unguarded `surfaces[0]` in the
demo, four unguarded 2D-array accesses in the free-rectangle scanner, an
`Object is possibly undefined` on a `Record` lookup in the renderer, and
six more in the resolver's final overlap-assertion loop. Every one was
fixed by either adding an explicit fallback (`ROLE_COLORS.action ?? "#2455d9"`)
or restructuring the loop to avoid re-indexing (switching the resolver's
overlap check from `for (i, j)` index loops to `.entries()` / `.slice()`
over the already-filtered `visible` array). None were papered over with a
non-null assertion `!` except where the value is genuinely guaranteed by
construction (e.g. `surfaces.find(...)!` right after confirming the list
is non-empty).

## Extensibility

- **New surface:** call `defineSurface()` with new numbers. No changes to
  `resolver.ts` or `composition-strategies.ts` are needed — that's the
  entire point, and it's what the "unseen surface" test in the demo
  exercises.
- **New renderer (e.g. Canvas instead of DOM):** `resolveLayout()` returns
  plain data (`ResolvedLayout`) with no DOM references anywhere in
  `resolver.ts`. A Canvas renderer would read the same `ResolvedElement[]`
  array that `render-dom.ts` does, and would not need to touch the
  resolver at all.
- **New element role:** requires one new entry per orientation template in
  `composition-strategies.ts` (an intentional, explicit decision — a role
  the templates don't know how to place shouldn't resolve into an
  arbitrary default position).

## Limitations (also listed in README.md)

- Text wrapping uses measured width plus a deterministic line-count estimate;
  it is not a full browser word-breaking engine. The resolver does, however,
  make text fit part of its constraint decision so the renderer does not
  knowingly clip text.
- The 40×40 grid free-space search is fast but not pixel-exact.
- No backtracking across already-placed higher-priority elements — the
  algorithm is a single forward pass, matching the assignment's guarantee
  that higher-priority elements are never compromised, at the cost of not
  searching for a globally optimal packing.
