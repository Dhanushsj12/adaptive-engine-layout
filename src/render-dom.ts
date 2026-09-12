import { RENDER_FONT_FAMILY } from "./text-measure";
import type {
  AdElement,
  AdSpec,
  ElementRole,
  ResolvedElement,
  ResolvedLayout,
} from "./types";

const ROLE_COLORS: Record<ElementRole, string> = {
  hero: "#c7cbd1",
  primary: "#1b1f23",
  secondary: "#5a5f66",
  action: "#2455d9",
  branding: "#8a8f96",
};

type RenderedElement = ResolvedElement & {
  lineClampLines?: number;
  truncated?: boolean;
};

type RenderContainer = HTMLElement & {
  __layoutObserver?: ResizeObserver;
  __layoutResizeHandler?: () => void;
};

export function renderLayoutToDOM(layout: ResolvedLayout, spec: AdSpec, container: HTMLElement): void {
  const host = container as RenderContainer;

  host.__layoutObserver?.disconnect();
  host.__layoutObserver = undefined;

  if (host.__layoutResizeHandler) {
    window.removeEventListener("resize", host.__layoutResizeHandler);
    host.__layoutResizeHandler = undefined;
  }

  container.replaceChildren();

  container.style.position = "relative";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.minWidth = "0";
  container.style.minHeight = "0";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.overflow = "hidden";
  container.style.boxSizing = "border-box";

  const preview = document.createElement("div");
  preview.style.position = "relative";
  preview.style.flex = "0 0 auto";
  preview.style.overflow = "visible";

  const surface = document.createElement("div");
  surface.style.position = "absolute";
  surface.style.left = "0";
  surface.style.top = "0";
  surface.style.width = `${layout.surfaceWidth}px`;
  surface.style.height = `${layout.surfaceHeight}px`;
  surface.style.boxSizing = "border-box";
  surface.style.background = "#f4f4f2";
  surface.style.border = "1px solid #d8d8d4";
  surface.style.overflow = "hidden";
  surface.style.transformOrigin = "top left";

  const byId = new Map<string, AdElement>(spec.elements.map((element) => [element.id, element]));

  for (const rawElement of layout.elements) {
    const element = rawElement as RenderedElement;
    if (!element.visible) continue;
    const source = byId.get(element.id);
    surface.appendChild(renderElement(element, source));
  }

  preview.appendChild(surface);
  container.appendChild(preview);

  const updateScale = (): void => {
    const frameWidth = container.clientWidth;
    const frameHeight = container.clientHeight;
    if (frameWidth <= 0 || frameHeight <= 0) return;

    const padding = 24;
    const availableWidth = Math.max(1, frameWidth - padding * 2);
    const availableHeight = Math.max(1, frameHeight - padding * 2);
    const scaleX = availableWidth / layout.surfaceWidth;
    const scaleY = availableHeight / layout.surfaceHeight;
    const scale = Math.min(1, scaleX, scaleY);

    preview.style.width = `${layout.surfaceWidth * scale}px`;
    preview.style.height = `${layout.surfaceHeight * scale}px`;
    surface.style.transform = `scale(${scale})`;
  };

  updateScale();

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    host.__layoutObserver = observer;
  } else {
    window.addEventListener("resize", updateScale);
    host.__layoutResizeHandler = updateScale;
  }
}

/**
 * Applies -webkit-line-clamp to an element. IMPORTANT: this must be a
 * plain block/inline element, never something also using
 * `display: flex` - the two display modes conflict and silently break
 * both centering and clamping. That's why text content lives in its own
 * inner <span>, separate from the outer flex box used for centering.
 */
function applyLineClamp(el: HTMLElement, lines: number): void {
  el.style.display = "-webkit-box";
  (el.style as unknown as Record<string, string>)["-webkit-line-clamp"] = String(lines);
  (el.style as unknown as Record<string, string>)["-webkit-box-orient"] = "vertical";
  el.style.overflow = "hidden";
  el.style.overflowWrap = "normal";
  el.style.wordBreak = "normal";
  el.style.whiteSpace = "normal";
  el.style.width = "100%";
}

function renderElement(element: RenderedElement, source: AdElement | undefined): HTMLElement {
  const box = document.createElement(element.type === "button" ? "button" : "div");

  box.dataset.id = element.id;
  box.dataset.role = element.role;
  box.dataset.degradation = element.degradation;

  // EXACT resolver geometry - the renderer never recomputes this.
  box.style.position = "absolute";
  box.style.left = `${element.x}px`;
  box.style.top = `${element.y}px`;
  box.style.width = `${element.width}px`;
  box.style.height = `${element.height}px`;
  box.style.boxSizing = "border-box";

  // Outer box is ALWAYS a flex container for centering - this never
  // changes to `-webkit-box`, which is what caused centering and
  // clamping to silently fight each other before.
  box.style.display = "flex";
  box.style.alignItems = "center";
  box.style.justifyContent = "center";
  box.style.margin = "0";
  box.style.padding = "0 8px";
  box.style.fontFamily = RENDER_FONT_FAMILY;
  box.style.textAlign = "center";
  box.style.lineHeight = "1.25";
  box.style.overflow = "hidden";

  if (element.degradation !== "none") {
    box.style.outline = "1px dashed #c98a2c";
    box.style.outlineOffset = "-1px";
  }

  if (element.type === "image") {
    box.style.background = ROLE_COLORS[element.role];
    box.style.color = "rgba(255,255,255,.78)";
    box.style.fontSize = "11px";
    box.style.fontWeight = "700";
    box.style.letterSpacing = ".08em";
    box.textContent = source?.id ?? "image";
    return box;
  }

  if (element.type === "button") {
    const button = box as HTMLButtonElement;
    button.type = "button";
    button.style.background = ROLE_COLORS.action;
    button.style.color = "#ffffff";
    button.style.border = "0";
    button.style.borderRadius = "4px";
    button.style.cursor = "pointer";
    button.style.fontWeight = "700";

    const label = document.createElement("span");
    label.style.fontSize = `${element.fontSize ?? 14}px`;
    label.textContent = source?.content ?? "";
    if (element.lineClampLines && element.lineClampLines > 0) {
      applyLineClamp(label, element.lineClampLines);
    }
    button.appendChild(label);

    if (element.truncated) button.title = source?.content ?? "";
    return button;
  }

  // TEXT
  const label = document.createElement("span");
  label.style.color = ROLE_COLORS[element.role];
  label.style.fontSize = `${element.fontSize ?? 14}px`;
  label.style.fontWeight = element.role === "primary" ? "700" : "500";
  label.textContent = source?.content ?? "";
  if (element.lineClampLines && element.lineClampLines > 0) {
    applyLineClamp(label, element.lineClampLines);
  }
  box.appendChild(label);

  if (element.truncated) box.title = source?.content ?? "";

  return box;
}