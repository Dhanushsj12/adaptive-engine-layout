import type {
  AdElement,
  AdSpec,
  ResolvedElement,
  ResolvedLayout,
} from "./types";

const ROLE_COLORS: Record<string, string> = {
  hero: "#c7cbd1",
  primary: "#111827",
  secondary: "#5a5f66",
  action: "#2455d9",
  branding: "#8a8f96",
};

const SURFACE_BORDER = "#d8d8d4";
const SURFACE_BACKGROUND = "#f7f7f5";

/**
 * Renders a resolved layout into a DOM container.
 *
 * IMPORTANT:
 * - The resolver remains responsible for ALL layout decisions.
 * - This function only renders the already-resolved rectangles.
 * - No layout math is performed here.
 * - The actual resolved pixel dimensions are preserved.
 */
export function renderLayoutToDOM(
  layout: ResolvedLayout,
  spec: AdSpec,
  container: HTMLElement
): void {
  container.innerHTML = "";

  /*
   * The outer container acts as the preview viewport.
   * The inner surface is rendered at the exact dimensions produced
   * by the resolver and then scaled down only for presentation.
   */
  container.style.position = "relative";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.minHeight = "240px";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.overflow = "hidden";
  container.style.background = "#ffffff";
  container.style.border = `1px solid ${SURFACE_BORDER}`;
  container.style.boxSizing = "border-box";

  const viewport = document.createElement("div");

  viewport.style.position = "relative";
  viewport.style.width = `${layout.surfaceWidth}px`;
  viewport.style.height = `${layout.surfaceHeight}px`;
  viewport.style.flex = "0 0 auto";
  viewport.style.background = SURFACE_BACKGROUND;
  viewport.style.border = `1px solid ${SURFACE_BORDER}`;
  viewport.style.boxSizing = "border-box";
  viewport.style.overflow = "hidden";
  viewport.style.transformOrigin = "center center";

  /*
   * Determine how much the resolved surface needs to shrink
   * to remain completely visible inside the preview.
   *
   * We deliberately do NOT change the resolver coordinates.
   * Only the visual preview is scaled.
   */
  const availableWidth =
    container.clientWidth > 20 ? container.clientWidth - 20 : 1;

  const availableHeight =
    container.clientHeight > 20 ? container.clientHeight - 20 : 1;

  const widthScale = availableWidth / layout.surfaceWidth;
  const heightScale = availableHeight / layout.surfaceHeight;

  const scale = Math.min(
    1,
    widthScale,
    heightScale
  );

  viewport.style.transform = `scale(${scale})`;

  const byId = new Map<string, AdElement>(
    spec.elements.map((el) => [el.id, el])
  );

  for (const element of layout.elements) {
    if (!element.visible) {
      continue;
    }

    const source = byId.get(element.id);

    viewport.appendChild(
      renderElement(element, source)
    );
  }

  container.appendChild(viewport);
}

/**
 * Paint one already-resolved element.
 *
 * This function intentionally does not decide:
 * - position
 * - size
 * - priority
 * - collision resolution
 * - degradation
 *
 * Those decisions belong to resolver.ts.
 */
function renderElement(
  el: ResolvedElement,
  source: AdElement | undefined
): HTMLElement {
  const isButton = el.type === "button";

  const box = document.createElement(
    isButton ? "button" : "div"
  );

  box.dataset.role = el.role;
  box.dataset.degradation = el.degradation;

  /*
   * Exact resolver geometry.
   */
  box.style.position = "absolute";
  box.style.left = `${el.x}px`;
  box.style.top = `${el.y}px`;
  box.style.width = `${el.width}px`;
  box.style.height = `${el.height}px`;

  box.style.boxSizing = "border-box";

  /*
   * Basic layout for content inside the already-resolved rectangle.
   */
  box.style.display = "flex";
  box.style.alignItems = "center";
  box.style.justifyContent = "center";

  box.style.overflow = "hidden";

  box.style.fontFamily =
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  box.style.textAlign = "center";

  /*
   * Degraded elements receive the orange dashed outline.
   * Clean elements have no outline.
   */
  if (el.degradation !== "none") {
    box.style.border = "1px dashed #c98a2c";
  } else {
    box.style.border = "none";
  }

  /*
   * IMAGE
   */
  if (el.type === "image") {
    renderImage(box, el, source);
    return box;
  }

  /*
   * BUTTON / CTA
   */
  if (el.type === "button") {
    renderButton(box, el, source);
    return box;
  }

  /*
   * TEXT
   */
  renderText(box, el, source);

  return box;
}

/**
 * Render image placeholders.
 *
 * The assignment's resolver works with abstract ad elements,
 * so there is no real image asset to load here. The placeholder
 * makes the image role visually obvious without introducing
 * hardcoded layout logic.
 */
function renderImage(
  box: HTMLElement,
  el: ResolvedElement,
  source: AdElement | undefined
): void {
  box.style.background =
    ROLE_COLORS[el.role] ?? "#c7cbd1";

  box.style.color = "#ffffff";

  box.style.fontSize =
    `${Math.max(10, Math.min(18, (el.width + el.height) / 80))}px`;

  box.style.fontWeight = "500";

  box.style.letterSpacing = "0.01em";

  box.textContent =
    source?.id ?? "product-image";

  /*
   * Image placeholder label should never affect geometry.
   */
  box.style.whiteSpace = "nowrap";
  box.style.textOverflow = "ellipsis";
}

/**
 * Render CTA/button elements.
 */
function renderButton(
  box: HTMLElement,
  el: ResolvedElement,
  source: AdElement | undefined
): void {
  box.style.background =
    ROLE_COLORS.action ?? "#2455d9";

  box.style.color = "#ffffff";

  box.style.border = "none";

  box.style.borderRadius =
    `${Math.max(3, Math.min(8, el.height * 0.08))}px`;

  box.style.cursor = "default";

  box.style.fontSize =
    `${el.fontSize ?? 14}px`;

  box.style.fontWeight = "600";

  box.style.lineHeight = "1";

  box.style.whiteSpace = "nowrap";

  box.style.textOverflow = "ellipsis";

  box.style.padding = "0 12px";

  box.textContent =
    source?.content ?? "";
}

/**
 * Render text elements.
 */
function renderText(
  box: HTMLElement,
  el: ResolvedElement,
  source: AdElement | undefined
): void {
box.style.color = ROLE_COLORS[el.role] ?? "#1b1f23";

  box.style.fontSize =
    `${el.fontSize ?? 14}px`;

  box.style.fontWeight =
    el.role === "primary"
      ? "600"
      : "400";

  box.style.lineHeight = "1.2";

  box.style.padding = "0";

  box.style.whiteSpace = "normal";

  box.style.wordBreak = "normal";

  box.style.overflowWrap = "break-word";

  box.style.textOverflow = "ellipsis";

  /*
   * Keep the text strictly inside the resolver's rectangle.
   *
   * The resolver determines lineClampLines.
   * The renderer only enforces it visually.
   */
  const clamp =
    Math.max(
      1,
      Math.floor(el.lineClampLines ?? 1)
    );

  box.style.display = "-webkit-box";

  (
    box.style as unknown as Record<string, string>
  )["-webkit-line-clamp"] = String(clamp);

  (
    box.style as unknown as Record<string, string>
  )["-webkit-box-orient"] = "vertical";

  box.textContent =
    source?.content ?? "";
}