import type { AdElement, AdSpec, ResolvedElement, ResolvedLayout } from "./types";

const ROLE_COLORS: Record<string, string> = {
  hero: "#c7cbd1",
  primary: "#1b1f23",
  secondary: "#5a5f66",
  action: "#2455d9",
  branding: "#8a8f96",
};

/**
 * Renders a resolved layout into a container element. Purely presentational
 * - it does no layout math itself, it just paints the rectangles the
 * resolver already decided on. Swapping this for a Canvas renderer later
 * would not require touching resolver.ts at all.
 */
export function renderLayoutToDOM(
  layout: ResolvedLayout,
  spec: AdSpec,
  container: HTMLElement
): void {
  container.innerHTML = "";
  container.style.position = "relative";
  container.style.width = `${layout.surfaceWidth}px`;
  container.style.height = `${layout.surfaceHeight}px`;
  container.style.overflow = "hidden";
  container.style.background = "#f4f4f2";
  container.style.border = "1px solid #d8d8d4";

  const byId = new Map<string, AdElement>(spec.elements.map((el) => [el.id, el]));

  for (const el of layout.elements) {
    if (!el.visible) continue;
    const source = byId.get(el.id);
    container.appendChild(renderElement(el, source));
  }
}

function renderElement(el: ResolvedElement, source: AdElement | undefined): HTMLElement {
  const box = document.createElement(el.type === "button" ? "button" : "div");
  box.dataset.role = el.role;
  box.dataset.degradation = el.degradation;
  box.style.position = "absolute";
  box.style.left = `${el.x}px`;
  box.style.top = `${el.y}px`;
  box.style.width = `${el.width}px`;
  box.style.height = `${el.height}px`;
  box.style.boxSizing = "border-box";
  box.style.display = "flex";
  box.style.alignItems = "center";
  box.style.justifyContent = "center";
  box.style.overflow = "hidden";
  box.style.fontFamily = "system-ui, sans-serif";
  box.style.textAlign = "center";
  box.style.padding = "0";
  box.style.lineHeight = "1.25";
  box.style.whiteSpace = "normal";
  box.style.overflowWrap = "anywhere";
  box.style.border = el.degradation !== "none" ? "1px dashed #c98a2c" : "none";

  if (el.type === "image") {
    box.style.background = ROLE_COLORS[el.role] ?? "#ccc";
    box.textContent = source?.id ?? "image";
    box.style.color = "#ffffffaa";
    box.style.fontSize = "11px";
  } else if (el.type === "button") {
    box.style.background = ROLE_COLORS.action ?? "#2455d9";
    box.style.color = "#fff";
    box.style.border = "none";
    box.style.borderRadius = "4px";
    box.style.cursor = "pointer";
    box.style.fontSize = `${el.fontSize ?? 14}px`;
    box.textContent = source?.content ?? "";
  } else {
    box.style.color = ROLE_COLORS[el.role] ?? "#1b1f23";
    box.style.fontSize = `${el.fontSize ?? 14}px`;
    box.style.fontWeight = el.role === "primary" ? "600" : "400";
    box.textContent = source?.content ?? "";
  }

  return box;
}
