import type {
  AdElement,
  AdSpec,
  ElementRole,
  ResolvedElement,
  ResolvedLayout,
} from "./types";

const ROLE_COLORS:
  Record<ElementRole, string> = {
  hero: "#c7cbd1",
  primary: "#1b1f23",
  secondary: "#5a5f66",
  action: "#2455d9",
  branding: "#8a8f96",
};

type RenderedElement =
  ResolvedElement & {
    lineClampLines?: number;
    truncated?: boolean;
  };

type RenderContainer =
  HTMLElement & {
    __layoutObserver?: ResizeObserver;
    __layoutResizeHandler?: () => void;
  };

/**
 * Render an already-resolved layout.
 *
 * The resolver owns all layout decisions.
 *
 * Renderer responsibilities:
 *   - create the true-size surface
 *   - render resolved elements
 *   - scale the complete surface to fit the preview
 *
 * Renderer does NOT decide:
 *   - positions
 *   - sizes
 *   - orientation
 *   - degradation
 */
export function renderLayoutToDOM(
  layout: ResolvedLayout,
  spec: AdSpec,
  container: HTMLElement
): void {
  const host =
    container as RenderContainer;

  /*
   * Cleanup ResizeObserver.
   */
  host.__layoutObserver?.disconnect();
  host.__layoutObserver =
    undefined;

  /*
   * Cleanup fallback resize listener.
   */
  if (
    host.__layoutResizeHandler
  ) {
    window.removeEventListener(
      "resize",
      host.__layoutResizeHandler
    );

    host.__layoutResizeHandler =
      undefined;
  }

  /*
   * Clear previous surface.
   */
  container.replaceChildren();

  /*
   * Preview viewport.
   */
  container.style.position =
    "relative";

  container.style.width =
    "100%";

  container.style.height =
    "100%";

  container.style.minWidth =
    "0";

  container.style.minHeight =
    "0";

  container.style.display =
    "flex";

  container.style.alignItems =
    "center";

  container.style.justifyContent =
    "center";

  container.style.overflow =
    "hidden";

  container.style.boxSizing =
    "border-box";

  /*
   * Wrapper reserves only the scaled size.
   */
  const preview =
    document.createElement(
      "div"
    );

  preview.style.position =
    "relative";

  preview.style.flex =
    "0 0 auto";

  preview.style.overflow =
    "visible";

  /*
   * TRUE SURFACE.
   *
   * These dimensions remain exactly the resolved surface dimensions.
   */
  const surface =
    document.createElement(
      "div"
    );

  surface.style.position =
    "absolute";

  surface.style.left =
    "0";

  surface.style.top =
    "0";

  surface.style.width =
    `${layout.surfaceWidth}px`;

  surface.style.height =
    `${layout.surfaceHeight}px`;

  surface.style.boxSizing =
    "border-box";

  surface.style.background =
    "#f4f4f2";

  surface.style.border =
    "1px solid #d8d8d4";

  surface.style.overflow =
    "hidden";

  surface.style.transformOrigin =
    "top left";

  /*
   * Map source spec elements by id.
   */
  const byId =
    new Map<string, AdElement>(
      spec.elements.map(
        (element) => [
          element.id,
          element,
        ]
      )
    );

  /*
   * Paint only elements that survived resolution.
   */
  for (
    const rawElement of
      layout.elements
  ) {
    const element =
      rawElement as RenderedElement;

    if (!element.visible) {
      continue;
    }

    const source =
      byId.get(element.id);

    surface.appendChild(
      renderElement(
        element,
        source
      )
    );
  }

  preview.appendChild(
    surface
  );

  container.appendChild(
    preview
  );

  /**
   * Scale the complete true-size surface into the preview frame.
   */
  const updateScale =
    (): void => {
      const frameWidth =
        container.clientWidth;

      const frameHeight =
        container.clientHeight;

      if (
        frameWidth <= 0 ||
        frameHeight <= 0
      ) {
        return;
      }

      /*
       * Keep a small visual margin around the preview.
       */
      const padding = 24;

      const availableWidth =
        Math.max(
          1,
          frameWidth -
            padding * 2
        );

      const availableHeight =
        Math.max(
          1,
          frameHeight -
            padding * 2
        );

      const scaleX =
        availableWidth /
        layout.surfaceWidth;

      const scaleY =
        availableHeight /
        layout.surfaceHeight;

      /*
       * Never enlarge the true surface above 1:1.
       */
      const scale =
        Math.min(
          1,
          scaleX,
          scaleY
        );

      preview.style.width =
        `${layout.surfaceWidth * scale}px`;

      preview.style.height =
        `${layout.surfaceHeight * scale}px`;

      surface.style.transform =
        `scale(${scale})`;
    };

  updateScale();

  /*
   * Recalculate when the preview panel changes.
   */
  if (
    typeof ResizeObserver !==
    "undefined"
  ) {
    const observer =
      new ResizeObserver(
        updateScale
      );

    observer.observe(
      container
    );

    host.__layoutObserver =
      observer;
  } else {
    window.addEventListener(
      "resize",
      updateScale
    );

    host.__layoutResizeHandler =
      updateScale;
  }
}

/**
 * Render one already-resolved element.
 */
function renderElement(
  element: RenderedElement,
  source:
    | AdElement
    | undefined
): HTMLElement {
  const box =
    document.createElement(
      element.type ===
        "button"
        ? "button"
        : "div"
    );

  /*
   * Debug metadata.
   */
  box.dataset.id =
    element.id;

  box.dataset.role =
    element.role;

  box.dataset.degradation =
    element.degradation;

  /*
   * EXACT resolver geometry.
   */
  box.style.position =
    "absolute";

  box.style.left =
    `${element.x}px`;

  box.style.top =
    `${element.y}px`;

  box.style.width =
    `${element.width}px`;

  box.style.height =
    `${element.height}px`;

  box.style.boxSizing =
    "border-box";

  /*
   * Common rendering.
   */
  box.style.display =
    "flex";

  box.style.alignItems =
    "center";

  box.style.justifyContent =
    "center";

  box.style.margin =
    "0";

  box.style.padding =
    "0 8px";

  box.style.fontFamily =
    "system-ui, -apple-system, BlinkMacSystemFont, " +
    "\"Segoe UI\", sans-serif";

  box.style.textAlign =
    "center";

  box.style.lineHeight =
    "1.25";

  box.style.whiteSpace =
    "normal";

  box.style.overflowWrap =
    "anywhere";

  box.style.overflow =
    "hidden";

  /*
   * Visually mark degraded elements.
   */
  if (
    element.degradation !==
    "none"
  ) {
    box.style.outline =
      "1px dashed #c98a2c";

    box.style.outlineOffset =
      "-1px";
  }

  /*
   * IMAGE
   */
  if (
    element.type === "image"
  ) {
    box.style.background =
      ROLE_COLORS[
        element.role
      ];

    box.style.color =
      "rgba(255,255,255,.78)";

    box.style.fontSize =
      "11px";

    box.style.fontWeight =
      "700";

    box.style.letterSpacing =
      ".08em";

    box.textContent =
      source?.id ??
      "image";

    return box;
  }

  /*
   * BUTTON
   */
  if (
    element.type === "button"
  ) {
    const button =
      box as HTMLButtonElement;

    button.type =
      "button";

    /*
     * FIX:
     *
     * ROLE_COLORS is now Record<ElementRole, string>,
     * therefore ROLE_COLORS.action is definitely a string.
     */
    button.style.background =
      ROLE_COLORS.action;

    button.style.color =
      "#ffffff";

    button.style.border =
      "0";

    button.style.borderRadius =
      "4px";

    button.style.cursor =
      "pointer";

    button.style.fontSize =
      `${element.fontSize ?? 14}px`;

    button.style.fontWeight =
      "700";

    /*
     * Clamp button text when required.
     */
    if (
      element.lineClampLines &&
      element.lineClampLines > 0
    ) {
      button.style.display =
        "-webkit-box";

      button.style.webkitBoxOrient =
        "vertical";

      button.style.webkitLineClamp =
        String(
          element.lineClampLines
        );
    }

    button.textContent =
      source?.content ??
      "";

    if (
      element.truncated
    ) {
      button.title =
        source?.content ??
        "";
    }

    return button;
  }

  /*
   * TEXT
   */
  box.style.color =
    ROLE_COLORS[
      element.role
    ];

  box.style.fontSize =
    `${element.fontSize ?? 14}px`;

  box.style.fontWeight =
    element.role === "primary"
      ? "700"
      : "500";

  /*
   * Apply resolver-provided line clamp.
   */
  const lineCount =
    element.lineClampLines;

  if (
    lineCount &&
    lineCount > 0
  ) {
    box.style.display =
      "-webkit-box";

    box.style.webkitBoxOrient =
      "vertical";

    box.style.webkitLineClamp =
      String(lineCount);

    box.style.overflow =
      "hidden";
  }

  box.textContent =
    source?.content ??
    "";

  /*
   * Preserve complete text in tooltip when truncation happened.
   */
  if (
    element.truncated
  ) {
    box.title =
      source?.content ??
      "";
  }

  return box;
}