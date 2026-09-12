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

/**
 * Fictional product advertisement.
 *
 * This is intentionally not a real-world advertisement or brand.
 * The same single AdSpec is resolved independently for every surface.
 */
const productAd = defineAd({
  id: "nova-buds-pro",
  elements: [
    text({
      id: "headline",
      role: "primary",
      priority: 1,
      content: "NovaBuds Pro",
    }),

    image({
  id: "product-image",
  role: "hero",
  priority: 1,
  aspectRatio: 1,
  content: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
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
  content: "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=200&auto=format&fit=crop&q=80",
}),
  ],
});

/**
 * This surface exists only in the demo.
 * It is not referenced by the composition strategy or resolver.
 * This demonstrates that the resolver generalizes beyond known surfaces.
 */
const unseenSurface = defineSurface({
  id: "unseen-print-qr-panel",
  name: "Unseen: Print-to-Digital QR Panel",
  width: 600,
  height: 900,
  safeArea: {
    top: 20,
    right: 20,
    bottom: 40,
    left: 20,
  },
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

    btn.className =
      "surface-item" + (surface.id === activeId ? " active" : "");

    btn.type = "button";

    const name = document.createElement("span");
    name.className = "surface-name";
    name.textContent = surface.name;

    const dims = document.createElement("span");
    dims.className = "dims";
    dims.textContent = `${surface.width}×${surface.height}`;

    btn.appendChild(name);
    btn.appendChild(dims);

    btn.addEventListener("click", () => {
      activeId = surface.id;
      renderAll();
    });

    listEl.appendChild(btn);
  }
}

function renderAll(): void {
  renderSurfaceList();

  const surface = surfaces.find((s) => s.id === activeId);

  if (!surface) {
    return;
  }

  const layout = resolveLayout(productAd, surface);

  renderLayoutToDOM(
    layout,
    productAd,
    mountEl
  );

  captionEl.textContent =
    `${surface.name} — content box after safe-area insets, rendered at true pixel scale`;

  logEl.innerHTML = "";

  if (layout.warnings.length === 0) {
    const li = document.createElement("li");

    li.className = "clean";
    li.textContent =
      "Every element placed at its ideal size. No degradation needed.";

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