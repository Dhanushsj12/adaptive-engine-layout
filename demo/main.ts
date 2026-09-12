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
import { classifyOrientation } from "../src/composition-strategies";
import { renderLayoutToDOM } from "../src/render-dom";
import type { AdSpec, SurfaceProfile } from "../src/types";

interface AdState {
  headline: string;
  price: string;
  cta: string;
  productImage: string;
  logoImage: string;
}

// ============================================================
// AD STATE
// ============================================================

const currentAd: AdState = {
  headline: "NovaBuds Pro - Premium Sound",
  price: "₹2,800",
  cta: "Shop Now",

  productImage:
    "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",

  logoImage:
    "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=200&auto=format&fit=crop&q=80",
};

let heroInputMode: "url" | "file" = "url";
let logoInputMode: "url" | "file" = "url";

let customSurfaceOpen = false;
let contentOpen = false;

// ============================================================
// AD SPEC
// ============================================================

function getProductAd(): AdSpec {
  const elements = [
    text({
      id: "headline",
      role: "primary",
      priority: 1,
      content: currentAd.headline,
    }),

    image({
      id: "product-image",
      role: "hero",
      priority: 1,
      aspectRatio: 1,
      content: currentAd.productImage,
    }),

    button({
      id: "cta",
      role: "action",
      priority: 2,
      content: currentAd.cta,
    }),

    text({
      id: "price",
      role: "secondary",
      priority: 2,
      content: currentAd.price,
    }),

    image({
      id: "logo",
      role: "branding",
      priority: 3,
      aspectRatio: 1,
      content: currentAd.logoImage,
    }),
  ];

  return defineAd({
    id: "nova-buds-pro",
    elements,
  });
}

// ============================================================
// SURFACES
// ============================================================

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

let activeId = surfaces[0]!.id;

// ============================================================
// DOM
// ============================================================

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(
      `Demo markup is missing required element #${id}.`
    );
  }

  return element;
}

const listEl = requireElement("surface-list");
const mountEl = requireElement("canvas-mount");
const captionEl = requireElement("proof-caption");
const logEl = requireElement("log-list");
const surfaceCountEl = requireElement("surface-count");

const titleEl = requireElement(
  "active-surface-title"
);

const dimensionsEl = requireElement(
  "preview-dimensions"
);

const orientationEl = requireElement(
  "preview-orientation"
);

const constraintStripEl = requireElement(
  "constraint-strip"
);

const resolutionSummaryEl = requireElement(
  "resolution-summary"
);

// ============================================================
// ORIENTATION
// ============================================================

function getOrientation(
  surface: SurfaceProfile
): string {
  return classifyOrientation(
    surface.width,
    surface.height
  );
}

function orientationIcon(
  surface: SurfaceProfile
): string {
  const orientation =
    getOrientation(surface);

  switch (orientation) {
    case "portrait":
      return "↕";

    case "landscape":
      return "↔";

    case "wide-banner":
      return "⇆";

    case "square":
      return "□";

    default:
      return "□";
  }
}

// ============================================================
// HTML SAFETY
// ============================================================

function escapeHtml(
  value: string
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// CONTROL STYLES
// ============================================================

function addDemoStyles(): void {
  if (
    document.getElementById(
      "ale-demo-controls-style"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "ale-demo-controls-style";

  style.textContent = `
    .ale-controls {
      margin-top: 18px;
      border: 1px solid var(--rule);
      border-radius: 8px;
      background: rgba(255,255,255,.55);
      overflow: hidden;
    }

    .ale-control-header {
      padding: 12px;
      border-bottom: 1px solid var(--rule);
    }

    .ale-control-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .ale-control-copy {
      margin-top: 4px;
      color: var(--ink-faint);
      font-size: 9px;
      line-height: 1.4;
    }

    .ale-accordion {
      border-top: 1px solid var(--rule);
    }

    .ale-accordion:first-child {
      border-top: 0;
    }

    .ale-accordion-toggle {
      width: 100%;
      border: 0;
      background: transparent;
      padding: 10px 12px;

      display: flex;
      justify-content: space-between;
      align-items: center;

      cursor: pointer;

      color: var(--ink);
      font-size: 10px;
      font-weight: 700;
      text-align: left;
    }

    .ale-accordion-toggle:hover {
      background: rgba(255,255,255,.8);
    }

    .ale-accordion-body {
      padding: 0 12px 12px;
    }

    .ale-field {
      margin-top: 9px;
    }

    .ale-field:first-child {
      margin-top: 0;
    }

    .ale-field label {
      display: block;
      margin-bottom: 4px;

      color: var(--ink-soft);

      font-size: 9px;
      font-weight: 700;
    }

    .ale-input {
      width: 100%;
      min-width: 0;

      padding: 7px 8px;

      box-sizing: border-box;

      border: 1px solid var(--rule);
      border-radius: 6px;

      background: #fff;
      color: var(--ink);

      font-size: 10px;
    }

    .ale-input:focus {
      outline: 2px solid rgba(36,85,217,.15);
      outline-offset: 1px;
    }

    .ale-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .ale-button {
      width: 100%;

      margin-top: 10px;
      padding: 8px 10px;

      border: 1px solid var(--ink);
      border-radius: 6px;

      background: var(--ink);
      color: #fff;

      font-size: 10px;
      font-weight: 700;

      cursor: pointer;
    }

    .ale-button:hover {
      opacity: .9;
    }

    .ale-radio {
      display: flex;
      justify-content: flex-end;
      gap: 8px;

      margin-bottom: 5px;

      color: var(--ink-soft);
      font-size: 9px;
    }

    .ale-radio label {
      display: inline-flex;
      align-items: center;
      gap: 3px;

      margin: 0;
    }

    .ale-error {
      margin-top: 8px;
      padding: 7px 8px;

      border: 1px solid #e5b66d;
      border-radius: 6px;

      background: #fff8e8;
      color: #8a5a13;

      font-size: 9px;
      line-height: 1.4;
    }

    @media (max-width: 760px) {
      .ale-two {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

// ============================================================
// SURFACE LIST
// ============================================================

function renderSurfaceList(): void {
  listEl.replaceChildren();

  surfaceCountEl.textContent =
    String(surfaces.length);

  for (const surface of surfaces) {
    const surfaceButton =
      document.createElement("button");

    surfaceButton.type = "button";

    surfaceButton.className =
      `surface-item${
        surface.id === activeId
          ? " active"
          : ""
      }`;

    surfaceButton.setAttribute(
      "aria-current",
      surface.id === activeId
        ? "true"
        : "false"
    );

    const info =
      document.createElement("span");

    const name =
      document.createElement("span");

    name.className =
      "surface-name";

    name.textContent =
      surface.name;

    const badge =
      document.createElement("span");

    badge.className =
      "ae-surface-badge";

    badge.textContent =
      `${orientationIcon(surface)} ${getOrientation(surface)}`;

    info.appendChild(name);
    info.appendChild(badge);

    const dims =
      document.createElement("span");

    dims.className =
      "dims";

    dims.textContent =
      `${surface.width}×${surface.height}`;

    surfaceButton.appendChild(info);
    surfaceButton.appendChild(dims);

    surfaceButton.addEventListener(
      "click",
      () => {
        activeId = surface.id;
        renderAll();
      }
    );

    listEl.appendChild(
      surfaceButton
    );
  }
}

// ============================================================
// CONSTRAINTS
// ============================================================

function formatSafeArea(
  surface: SurfaceProfile
): string {
  const safe = surface.safeArea;

  if (!safe) {
    return "none";
  }

  return (
    `${safe.top}/` +
    `${safe.right}/` +
    `${safe.bottom}/` +
    `${safe.left}`
  );
}

function renderConstraints(
  surface: SurfaceProfile
): void {
  constraintStripEl.replaceChildren();

  const constraints: string[] = [
    `Safe ${formatSafeArea(surface)}`,
  ];

  if (surface.minTapTarget) {
    constraints.push(
      `Tap ≥ ${surface.minTapTarget}px`
    );
  } else {
    constraints.push(
      "No tap floor"
    );
  }

  if (surface.minTextSize) {
    constraints.push(
      `Text ≥ ${surface.minTextSize}px`
    );
  } else {
    constraints.push(
      "Default text floor"
    );
  }

  constraints.push(
    surface.touchOnly
      ? "Touch"
      : "Non-touch"
  );

  if (surface.viewingDistance) {
    constraints.push(
      `Viewing ${surface.viewingDistance}`
    );
  }

  for (const label of constraints) {
    const chip =
      document.createElement("span");

    chip.className =
      "constraint-chip";

    chip.textContent =
      label;

    constraintStripEl.appendChild(
      chip
    );
  }
}

// ============================================================
// RESOLUTION UI
// ============================================================

function updateResolutionUI(
  surface: SurfaceProfile,
  layout: ReturnType<typeof resolveLayout>
): void {
  const visibleCount =
    layout.elements.filter(
      (element) =>
        element.visible
    ).length;

  const droppedCount =
    layout.elements.filter(
      (element) =>
        !element.visible
    ).length;

  const degradedCount =
    layout.elements.filter(
      (element) =>
        element.visible &&
        (element.degradation !==
          "none" ||
          element.truncated)
    ).length;

  titleEl.textContent =
    surface.name;

  dimensionsEl.textContent =
    `${surface.width} × ${surface.height}`;

  orientationEl.textContent =
    `${orientationIcon(surface)} ${getOrientation(surface)}`;

  resolutionSummaryEl.innerHTML = `
    <div class="resolution-stat">
      <strong>
        ${visibleCount}/${layout.elements.length}
      </strong>
      <span>visible</span>
    </div>

    <div class="resolution-stat">
      <strong>
        ${degradedCount}
      </strong>
      <span>adapted</span>
    </div>

    <div class="resolution-stat">
      <strong>
        ${droppedCount}
      </strong>
      <span>dropped</span>
    </div>
  `;

  logEl.replaceChildren();

  if (
    layout.warnings.length === 0
  ) {
    const li =
      document.createElement("li");

    li.className =
      "clean";

    li.textContent =
      "All elements satisfy the active surface constraints.";

    logEl.appendChild(li);
  } else {
    for (
      const warning of layout.warnings
    ) {
      const li =
        document.createElement("li");

      li.className =
        "warn";

      li.textContent =
        warning;

      logEl.appendChild(li);
    }
  }

  if (
    layout.warnings.length === 0
  ) {
    captionEl.textContent =
      `${surface.name} resolved cleanly from the same declarative ad specification.`;
  } else {
    captionEl.textContent =
      `${surface.name} required ${
        layout.warnings.length
      } resolver decision${
        layout.warnings.length === 1
          ? ""
          : "s"
      }; higher-priority content was protected first.`;
  }

  renderConstraints(surface);
}

// ============================================================
// MAIN RESOLUTION
// ============================================================

function renderAll(): void {
  renderSurfaceList();

  const surface =
    surfaces.find(
      (candidate) =>
        candidate.id === activeId
    );

  if (!surface) {
    return;
  }

  const spec =
    getProductAd();

  const layout =
    resolveLayout(
      spec,
      surface
    );

  renderLayoutToDOM(
    layout,
    spec,
    mountEl
  );

  updateResolutionUI(
    surface,
    layout
  );
}

// ============================================================
// INPUT HELPER
// ============================================================

function getInput(
  id: string
): HTMLInputElement {
  const input =
    document.getElementById(id);

  if (
    !(input instanceof HTMLInputElement)
  ) {
    throw new Error(
      `Expected input #${id}.`
    );
  }

  return input;
}

// ============================================================
// FILE READER
// ============================================================

function readFile(
  file: File
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        resolve(
          String(reader.result)
        );
      };

      reader.onerror = () => {
        reject(
          reader.error ??
            new Error(
              "Could not read image file."
            )
        );
      };

      reader.readAsDataURL(file);
    }
  );
}

// ============================================================
// CONTROLS
// ============================================================

function createControls(): void {
  const rightColumn =
    logEl.parentElement;

  if (!rightColumn) {
    return;
  }

  if (
    document.getElementById(
      "ale-controls"
    )
  ) {
    return;
  }

  const controls =
    document.createElement("section");

  controls.id =
    "ale-controls";

  controls.className =
    "ale-controls";

  controls.innerHTML = `
    <div class="ale-control-header">
      <div class="ale-control-title">
        Controls
      </div>

      <div class="ale-control-copy">
        Change the surface or creative input,
        then resolve again.
      </div>
    </div>

    <!-- CUSTOM SURFACE -->

    <div class="ale-accordion">
      <button
        id="ale-toggle-surface"
        class="ale-accordion-toggle"
        type="button"
        aria-expanded="false"
      >
        <span>Custom Surface</span>
        <span id="ale-surface-icon">+</span>
      </button>

      <div
        id="ale-surface-body"
        class="ale-accordion-body"
        hidden
      >
        <div class="ale-field">
          <label for="ale-width">
            Width
          </label>

          <input
            class="ale-input"
            id="ale-width"
            type="number"
            min="1"
            value="1400"
          />
        </div>

        <div class="ale-field">
          <label for="ale-height">
            Height
          </label>

          <input
            class="ale-input"
            id="ale-height"
            type="number"
            min="1"
            value="800"
          />
        </div>

        <div class="ale-field">
          <label for="ale-safe">
            Safe-area inset
          </label>

          <input
            class="ale-input"
            id="ale-safe"
            type="number"
            min="0"
            value="10"
          />
        </div>

        <div class="ale-field">
          <label for="ale-tap">
            Minimum tap target
            (0 = non-touch)
          </label>

          <input
            class="ale-input"
            id="ale-tap"
            type="number"
            min="0"
            value="44"
          />
        </div>

        <button
          id="ale-apply-surface"
          class="ale-button"
          type="button"
        >
          Resolve Custom Surface
        </button>

        <div
          id="ale-surface-error"
          class="ale-error"
          hidden
        ></div>
      </div>
    </div>

    <!-- AD CONTENT -->

    <div class="ale-accordion">
      <button
        id="ale-toggle-content"
        class="ale-accordion-toggle"
        type="button"
        aria-expanded="false"
      >
        <span>Ad Content</span>
        <span id="ale-content-icon">+</span>
      </button>

      <div
        id="ale-content-body"
        class="ale-accordion-body"
        hidden
      >
        <div class="ale-field">
          <label for="ale-headline">
            Product title
          </label>

          <input
            class="ale-input"
            id="ale-headline"
            value="${escapeHtml(currentAd.headline)}"
          />
        </div>

        <div class="ale-field">
          <label for="ale-price">
            Price
          </label>

          <input
            class="ale-input"
            id="ale-price"
            value="${escapeHtml(currentAd.price)}"
          />
        </div>

        <div class="ale-field">
          <label for="ale-cta">
            CTA
          </label>

          <input
            class="ale-input"
            id="ale-cta"
            value="${escapeHtml(currentAd.cta)}"
          />
        </div>

        <div class="ale-field">
          <label>
            Product image
          </label>

          <div class="ale-radio">
            <label>
              <input
                type="radio"
                name="ale-hero-mode"
                value="url"
                checked
              />
              URL
            </label>

            <label>
              <input
                type="radio"
                name="ale-hero-mode"
                value="file"
              />
              Upload
            </label>
          </div>

          <input
            class="ale-input"
            id="ale-hero-url"
            value="${escapeHtml(currentAd.productImage)}"
            placeholder="Image URL"
          />

          <input
            id="ale-hero-file"
            type="file"
            accept="image/*"
            hidden
          />
        </div>

        <div class="ale-field">
          <label>
            Logo image
          </label>

          <div class="ale-radio">
            <label>
              <input
                type="radio"
                name="ale-logo-mode"
                value="url"
                checked
              />
              URL
            </label>

            <label>
              <input
                type="radio"
                name="ale-logo-mode"
                value="file"
              />
              Upload
            </label>
          </div>

          <input
            class="ale-input"
            id="ale-logo-url"
            value="${escapeHtml(currentAd.logoImage)}"
            placeholder="Image URL"
          />

          <input
            id="ale-logo-file"
            type="file"
            accept="image/*"
            hidden
          />
        </div>

        <button
          id="ale-update-content"
          class="ale-button"
          type="button"
        >
          Resolve Updated Creative
        </button>
      </div>
    </div>
  `;

  rightColumn.appendChild(
    controls
  );

  // ----------------------------------------------------------
  // SURFACE ACCORDION
  // ----------------------------------------------------------

  const surfaceToggle =
    document.getElementById(
      "ale-toggle-surface"
    )!;

  const surfaceBody =
    document.getElementById(
      "ale-surface-body"
    )!;

  const surfaceIcon =
    document.getElementById(
      "ale-surface-icon"
    )!;

  surfaceToggle.addEventListener(
    "click",
    () => {
      customSurfaceOpen =
        !customSurfaceOpen;

      surfaceBody.toggleAttribute(
        "hidden",
        !customSurfaceOpen
      );

      surfaceToggle.setAttribute(
        "aria-expanded",
        String(customSurfaceOpen)
      );

      surfaceIcon.textContent =
        customSurfaceOpen
          ? "−"
          : "+";
    }
  );

  // ----------------------------------------------------------
  // CONTENT ACCORDION
  // ----------------------------------------------------------

  const contentToggle =
    document.getElementById(
      "ale-toggle-content"
    )!;

  const contentBody =
    document.getElementById(
      "ale-content-body"
    )!;

  const contentIcon =
    document.getElementById(
      "ale-content-icon"
    )!;

  contentToggle.addEventListener(
    "click",
    () => {
      contentOpen =
        !contentOpen;

      contentBody.toggleAttribute(
        "hidden",
        !contentOpen
      );

      contentToggle.setAttribute(
        "aria-expanded",
        String(contentOpen)
      );

      contentIcon.textContent =
        contentOpen
          ? "−"
          : "+";
    }
  );

  // ----------------------------------------------------------
  // HERO MODE
  // ----------------------------------------------------------

  document
    .querySelectorAll<HTMLInputElement>(
      'input[name="ale-hero-mode"]'
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          () => {
            heroInputMode =
              input.value as
                | "url"
                | "file";

            getInput(
              "ale-hero-url"
            ).hidden =
              heroInputMode !==
              "url";

            getInput(
              "ale-hero-file"
            ).hidden =
              heroInputMode !==
              "file";
          }
        );
      }
    );

  // ----------------------------------------------------------
  // LOGO MODE
  // ----------------------------------------------------------

  document
    .querySelectorAll<HTMLInputElement>(
      'input[name="ale-logo-mode"]'
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          () => {
            logoInputMode =
              input.value as
                | "url"
                | "file";

            getInput(
              "ale-logo-url"
            ).hidden =
              logoInputMode !==
              "url";

            getInput(
              "ale-logo-file"
            ).hidden =
              logoInputMode !==
              "file";
          }
        );
      }
    );

  // ----------------------------------------------------------
  // BUTTONS
  // ----------------------------------------------------------

  document
    .getElementById(
      "ale-apply-surface"
    )
    ?.addEventListener(
      "click",
      applyCustomSurface
    );

  document
    .getElementById(
      "ale-update-content"
    )
    ?.addEventListener(
      "click",
      updateAdContent
    );
}

// ============================================================
// CUSTOM SURFACE
// ============================================================

function applyCustomSurface(): void {
  const width =
    Number(
      getInput("ale-width").value
    );

  const height =
    Number(
      getInput("ale-height").value
    );

  const safe =
    Number(
      getInput("ale-safe").value
    );

  const tap =
    Number(
      getInput("ale-tap").value
    );

  const error =
    document.getElementById(
      "ale-surface-error"
    );

  try {
    if (
      ![
        width,
        height,
        safe,
        tap,
      ].every(Number.isFinite)
    ) {
      throw new Error(
        "All custom surface values must be finite numbers."
      );
    }

    if (
      width <= 0 ||
      height <= 0
    ) {
      throw new Error(
        "Width and height must be greater than zero."
      );
    }

    if (safe < 0) {
      throw new Error(
        "Safe-area inset cannot be negative."
      );
    }

    if (
      safe * 2 >= width ||
      safe * 2 >= height
    ) {
      throw new Error(
        "Safe-area inset is too large for this surface."
      );
    }

    if (tap < 0) {
      throw new Error(
        "Minimum tap target cannot be negative."
      );
    }

    const custom =
      defineSurface({
        id:
          `custom-${width}x${height}-${Date.now()}`,

        name:
          `Custom (${width}×${height})`,

        width,
        height,

        safeArea: {
          top: safe,
          right: safe,
          bottom: safe,
          left: safe,
        },

        minTapTarget:
          tap > 0
            ? tap
            : undefined,

        touchOnly:
          tap > 0,
      });

    surfaces.push(custom);

    activeId =
      custom.id;

    if (error) {
      error.hidden = true;
      error.textContent = "";
    }

    renderAll();
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Unable to create custom surface.";

    if (error) {
      error.textContent =
        message;

      error.hidden = false;
    }
  }
}

// ============================================================
// UPDATE CREATIVE
// ============================================================

async function updateAdContent(): Promise<void> {
  const headline =
    getInput(
      "ale-headline"
    ).value.trim();

  const price =
    getInput(
      "ale-price"
    ).value.trim();

  const cta =
    getInput(
      "ale-cta"
    ).value.trim();

  if (
    !headline ||
    !price ||
    !cta
  ) {
    alert(
      "Product title, price and CTA are required."
    );

    return;
  }

  let productImage =
    currentAd.productImage;

  let logoImage =
    currentAd.logoImage;

  // ----------------------------------------------------------
  // PRODUCT IMAGE
  // ----------------------------------------------------------

  if (
    heroInputMode ===
    "url"
  ) {
    const value =
      getInput(
        "ale-hero-url"
      ).value.trim();

    if (value) {
      productImage =
        value;
    }
  } else {
    const file =
      getInput(
        "ale-hero-file"
      ).files?.[0];

    if (file) {
      productImage =
        await readFile(file);
    }
  }

  // ----------------------------------------------------------
  // LOGO
  // ----------------------------------------------------------

  if (
    logoInputMode ===
    "url"
  ) {
    const value =
      getInput(
        "ale-logo-url"
      ).value.trim();

    if (value) {
      logoImage =
        value;
    }
  } else {
    const file =
      getInput(
        "ale-logo-file"
      ).files?.[0];

    if (file) {
      logoImage =
        await readFile(file);
    }
  }

  currentAd.headline =
    headline;

  currentAd.price =
    price;

  currentAd.cta =
    cta;

  currentAd.productImage =
    productImage;

  currentAd.logoImage =
    logoImage;

  renderAll();
}

// ============================================================
// INITIALIZATION
// ============================================================

function initialize(): void {
  addDemoStyles();
  createControls();
  renderAll();
}

initialize();
