import { button, defineAd, image, text } from "../src/spec";
import {
  broadcastLowerThird,
  defineSurface,
  impossiblyTightBanner,
  mobileLandscape,
  mobilePortrait,
  retailKiosk,
} from "../src/surfaces";
import { resolveLayout } from "../src/resolver";
import { renderLayoutToDOM } from "../src/render-dom";
import type { SurfaceProfile } from "../src/types";

const productAd = defineAd({
  id: "summer-sale",
  elements: [
    text({ id: "headline", role: "primary", priority: 1, content: "Summer Sale — 40% Off Everything" }),
    image({ id: "product-image", role: "hero", priority: 1, aspectRatio: 1 }),
    button({ id: "cta", role: "action", priority: 2, content: "Shop Now" }),
    text({ id: "price", role: "secondary", priority: 2, content: "$29.99" }),
    image({ id: "logo", role: "branding", priority: 3, aspectRatio: 1 }),
  ],
});

// The 5th profile is defined only here, in the demo - it exists to prove
// the resolver generalizes to a surface it has never been coded against.
const unseenSurface = defineSurface({
  id: "unseen-print-qr-panel",
  name: "Unseen: Print-to-Digital QR Panel",
  width: 600,
  height: 900,
  safeArea: { top: 20, right: 20, bottom: 40, left: 20 },
  touchOnly: false,
});

const surfaces: SurfaceProfile[] = [
  mobilePortrait,
  mobileLandscape,
  broadcastLowerThird,
  retailKiosk,
  unseenSurface,
  impossiblyTightBanner,
];

const listEl = document.getElementById("surface-list")!;
const mountEl = document.getElementById("canvas-mount")!;
const captionEl = document.getElementById("proof-caption")!;
const logEl = document.getElementById("log-list")!;

let activeId = surfaces[0]!.id;

function renderSurfaceList(): void {
  listEl.innerHTML = "";
  for (const surface of surfaces) {
    const btn = document.createElement("button");
    btn.className = "surface-item" + (surface.id === activeId ? " active" : "");
    btn.innerHTML = `${surface.name}<span class="dims">${surface.width}×${surface.height}</span>`;
    btn.addEventListener("click", () => {
      activeId = surface.id;
      renderAll();
    });
    listEl.appendChild(btn);
  }
}

function renderAll(): void {
  renderSurfaceList();
  const surface = surfaces.find((s) => s.id === activeId)!;
  const layout = resolveLayout(productAd, surface);

  renderLayoutToDOM(layout, productAd, mountEl as HTMLElement);

  captionEl.textContent = `${surface.name} — content box after safe-area insets, rendered at true pixel scale`;

  logEl.innerHTML = "";
  if (layout.warnings.length === 0) {
    const li = document.createElement("li");
    li.className = "clean";
    li.textContent = "Every element placed at its ideal size. No degradation needed.";
    logEl.appendChild(li);
  } else {
    for (const warning of layout.warnings) {
      const li = document.createElement("li");
      li.className = "warn";
      li.textContent = warning;
      logEl.appendChild(li);
    }
  }
}

renderAll();
