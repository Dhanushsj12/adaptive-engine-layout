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

// Dynamic Ad Spec State
let currentAdSpec = {
  headline: "NovaBuds Pro",
  price: "₹2,800",
  discount: "20% OFF",
  cta: "Shop Now",
  productImage:
    "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80",
  logoImage:
    "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=200&auto=format&fit=crop&q=80",
};

// UI Input Modes: 'url' | 'file'
let heroInputMode: "url" | "file" = "url";
let logoInputMode: "url" | "file" = "url";

// Accordion toggle states
let isCustomSurfaceOpen = false;
let isAdContentOpen = false;

/**
 * Creates the Ad Spec dynamically using current active state values.
 */
function getProductAd() {
  const elements = [
    text({
      id: "headline",
      role: "primary",
      priority: 1,
      content: currentAdSpec.headline,
    }),

    image({
      id: "product-image",
      role: "hero",
      priority: 1,
      aspectRatio: 1, // Layout engine maintains 1:1 bounding container; actual image scales seamlessly via CSS object-fit
      content: currentAdSpec.productImage,
    }),

    button({
      id: "cta",
      role: "action",
      priority: 2,
      content: currentAdSpec.cta,
    }),

    text({
      id: "price",
      role: "secondary",
      priority: 2,
      content: currentAdSpec.price,
    }),

    image({
      id: "logo",
      role: "branding",
      priority: 3,
      aspectRatio: 1,
      content: currentAdSpec.logoImage,
    }),
  ];

  if (currentAdSpec.discount) {
    elements.push(
      text({
        id: "discount",
        role: "secondary",
        priority: 3,
        content: currentAdSpec.discount,
      })
    );
  }

  return defineAd({
    id: "nova-buds-pro",
    elements,
  });
}

/**
 * Surface profiles preset list.
 */
const unseenSurface = defineSurface({
  id: "unseen-print-qr-panel",
  name: "Unseen: Print-to-Digital QR Panel",
  width: 600,
  height: 900,
  safeArea: { top: 20, right: 20, bottom: 40, left: 20 },
  touchOnly: false,
});

const defaultSurfaces: SurfaceProfile[] = [
  mobilePortrait,
  mobileLandscape,
  broadcastLowerThird,
  retailKiosk,
  unseenSurface,
  impossiblyTightBanner,
];

let surfaces: SurfaceProfile[] = [...defaultSurfaces];
let activeId = surfaces[0]!.id;

// DOM Element Handles
const listEl = document.getElementById("surface-list")!;
const mountEl = document.getElementById("canvas-mount")!;
const captionEl = document.getElementById("proof-caption")!;
const logEl = document.getElementById("log-list")!;

/**
 * Helper to convert uploaded files to Base64 Data URL
 */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Injects Customization Controls into the RIGHT sidebar.
 */
function injectRightSidebarControls(): void {
  const rightSidebarContainer = logEl.parentElement;
  if (!rightSidebarContainer || document.getElementById("custom-surface-box")) return;

  const controlContainer = document.createElement("div");
  controlContainer.id = "custom-surface-box";
  controlContainer.style.cssText =
    "margin-top: 24px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff; width: 100%; box-sizing: border-box;";

  controlContainer.innerHTML = `
    <div style="font-size: 11px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
      Customization Panel
    </div>

    <!-- 1. Custom Surface Input -->
    <div style="margin-bottom: 8px;">
      <button id="toggle-surface-btn" type="button" style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer; text-transform: uppercase;">
        <span>Custom Surface Input</span>
        <span id="icon-surface">▼</span>
      </button>

      <div id="panel-surface-content" style="display: none; padding: 10px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 4px 4px; background: #ffffff;">
        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <input type="number" id="custom-w" placeholder="Width" value="1400" style="width: 50%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;" />
          <input type="number" id="custom-h" placeholder="Height" value="800" style="width: 50%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px;" />
        </div>
        <button id="btn-apply-custom" type="button" style="width: 100%; padding: 7px 10px; background: #2563eb; color: #ffffff; border: none; border-radius: 4px; font-weight: 600; font-size: 12px; cursor: pointer;">
          Apply Custom Surface
        </button>
      </div>
    </div>

    <!-- 2. Ad Content Controls -->
    <div>
      <button id="toggle-content-btn" type="button" style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer; text-transform: uppercase;">
        <span>Ad Content Controls</span>
        <span id="icon-content">▼</span>
      </button>

      <div id="panel-content-fields" style="display: none; padding: 10px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 4px 4px; background: #ffffff;">
        <label style="font-size: 10px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Product Title</label>
        <input type="text" id="input-headline" value="${currentAdSpec.headline}" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; margin-bottom: 6px; box-sizing: border-box;" />

        <div style="display: flex; gap: 6px; margin-bottom: 6px;">
          <div style="width: 50%;">
            <label style="font-size: 10px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Price Tag</label>
            <input type="text" id="input-price" value="${currentAdSpec.price}" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; box-sizing: border-box;" />
          </div>
          <div style="width: 50%;">
            <label style="font-size: 10px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">Discount Tag</label>
            <input type="text" id="input-discount" value="${currentAdSpec.discount}" placeholder="e.g. 20% OFF" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; box-sizing: border-box;" />
          </div>
        </div>

        <label style="font-size: 10px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">CTA Button Text</label>
        <input type="text" id="input-cta" value="${currentAdSpec.cta}" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12px; margin-bottom: 10px; box-sizing: border-box;" />

        <!-- HERO IMAGE CONTROLS -->
        <div style="border-top: 1px solid #f1f5f9; padding-top: 6px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label style="font-size: 10px; color: #64748b; font-weight: 600;">Product Image</label>
            <div style="font-size: 10px;">
              <label style="cursor: pointer; margin-right: 6px;"><input type="radio" name="hero-mode" value="url" checked /> URL</label>
              <label style="cursor: pointer;"><input type="radio" name="hero-mode" value="file" /> Upload</label>
            </div>
          </div>
          <input type="text" id="input-hero-url" value="${currentAdSpec.productImage}" placeholder="Paste Image URL" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 11px; box-sizing: border-box;" />
          <input type="file" id="upload-hero" accept="image/*" style="width: 100%; font-size: 11px; display: none;" />
        </div>

        <!-- LOGO IMAGE CONTROLS -->
        <div style="border-top: 1px solid #f1f5f9; padding-top: 6px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label style="font-size: 10px; color: #64748b; font-weight: 600;">Logo Image</label>
            <div style="font-size: 10px;">
              <label style="cursor: pointer; margin-right: 6px;"><input type="radio" name="logo-mode" value="url" checked /> URL</label>
              <label style="cursor: pointer;"><input type="radio" name="logo-mode" value="file" /> Upload</label>
            </div>
          </div>
          <input type="text" id="input-logo-url" value="${currentAdSpec.logoImage}" placeholder="Paste Logo URL" style="width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 11px; box-sizing: border-box;" />
          <input type="file" id="upload-logo" accept="image/*" style="width: 100%; font-size: 11px; display: none;" />
        </div>

        <button id="btn-update-ad" type="button" style="width: 100%; padding: 7px 10px; background: #0f172a; color: #ffffff; border: none; border-radius: 4px; font-weight: 600; font-size: 12px; cursor: pointer;">
          Update Ad Content
        </button>
      </div>
    </div>
  `;

  rightSidebarContainer.appendChild(controlContainer);

  // Radio Toggle Events for Hero Image Mode
  document.querySelectorAll<HTMLInputElement>('input[name="hero-mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      heroInputMode = (e.target as HTMLInputElement).value as "url" | "file";
      const urlInput = document.getElementById("input-hero-url")!;
      const fileInput = document.getElementById("upload-hero")!;
      urlInput.style.display = heroInputMode === "url" ? "block" : "none";
      fileInput.style.display = heroInputMode === "file" ? "block" : "none";
    });
  });

  // Radio Toggle Events for Logo Image Mode
  document.querySelectorAll<HTMLInputElement>('input[name="logo-mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      logoInputMode = (e.target as HTMLInputElement).value as "url" | "file";
      const urlInput = document.getElementById("input-logo-url")!;
      const fileInput = document.getElementById("upload-logo")!;
      urlInput.style.display = logoInputMode === "url" ? "block" : "none";
      fileInput.style.display = logoInputMode === "file" ? "block" : "none";
    });
  });

  // Accordion Handlers
  document.getElementById("toggle-surface-btn")?.addEventListener("click", () => {
    isCustomSurfaceOpen = !isCustomSurfaceOpen;
    const panel = document.getElementById("panel-surface-content");
    const icon = document.getElementById("icon-surface");
    if (panel && icon) {
      panel.style.display = isCustomSurfaceOpen ? "block" : "none";
      icon.textContent = isCustomSurfaceOpen ? "▲" : "▼";
    }
  });

  document.getElementById("toggle-content-btn")?.addEventListener("click", () => {
    isAdContentOpen = !isAdContentOpen;
    const panel = document.getElementById("panel-content-fields");
    const icon = document.getElementById("icon-content");
    if (panel && icon) {
      panel.style.display = isAdContentOpen ? "block" : "none";
      icon.textContent = isAdContentOpen ? "▲" : "▼";
    }
  });

  // Action Buttons
  document.getElementById("btn-apply-custom")?.addEventListener("click", handleApplyCustomSurface);
  document.getElementById("btn-update-ad")?.addEventListener("click", handleUpdateAdContent);
}

function handleApplyCustomSurface(): void {
  const widthInput = document.getElementById("custom-w") as HTMLInputElement;
  const heightInput = document.getElementById("custom-h") as HTMLInputElement;

  const width = parseInt(widthInput?.value || "1400", 10);
  const height = parseInt(heightInput?.value || "800", 10);

  if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
    alert("Please enter valid positive width and height values.");
    return;
  }

  const newCustomSurface = defineSurface({
    id: `custom-${width}x${height}-${Date.now()}`,
    name: `Custom (${width}×${height})`,
    width,
    height,
    safeArea: { top: 10, right: 10, bottom: 10, left: 10 },
    touchOnly: false,
  });

  surfaces.push(newCustomSurface);
  activeId = newCustomSurface.id;
  renderAll();
}

async function handleUpdateAdContent(): Promise<void> {
  const headline = (document.getElementById("input-headline") as HTMLInputElement)?.value.trim();
  const price = (document.getElementById("input-price") as HTMLInputElement)?.value.trim();
  const discount = (document.getElementById("input-discount") as HTMLInputElement)?.value.trim();
  const cta = (document.getElementById("input-cta") as HTMLInputElement)?.value.trim();

  let heroUrl = currentAdSpec.productImage;
  let logoUrl = currentAdSpec.logoImage;

  // Process Product Hero Image
  if (heroInputMode === "url") {
    const urlVal = (document.getElementById("input-hero-url") as HTMLInputElement)?.value.trim();
    if (urlVal) heroUrl = urlVal;
  } else {
    const fileInput = document.getElementById("upload-hero") as HTMLInputElement;
    if (fileInput?.files?.[0]) {
      heroUrl = await fileToDataURL(fileInput.files[0]);
    }
  }

  // Process Logo Image
  if (logoInputMode === "url") {
    const urlVal = (document.getElementById("input-logo-url") as HTMLInputElement)?.value.trim();
    if (urlVal) logoUrl = urlVal;
  } else {
    const fileInput = document.getElementById("upload-logo") as HTMLInputElement;
    if (fileInput?.files?.[0]) {
      logoUrl = await fileToDataURL(fileInput.files[0]);
    }
  }

  currentAdSpec = {
    headline: headline || currentAdSpec.headline,
    price: price || currentAdSpec.price,
    discount: discount || "",
    cta: cta || currentAdSpec.cta,
    productImage: heroUrl,
    logoImage: logoUrl,
  };

  renderAll();
}

function renderSurfaceList(): void {
  listEl.innerHTML = "";

  for (const surface of surfaces) {
    const btn = document.createElement("button");

    btn.className = "surface-item" + (surface.id === activeId ? " active" : "");
    btn.setAttribute("aria-current", surface.id === activeId ? "true" : "false");
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
  if (!surface) return;

  const currentAd = getProductAd();
  const layout = resolveLayout(currentAd, surface);

  renderLayoutToDOM(layout, currentAd, mountEl);

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

// Initial Run
injectRightSidebarControls();
renderAll();