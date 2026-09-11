import type { AdElement, AdSpec, ElementRole } from "./types";

const VALID_ROLES: readonly ElementRole[] = [
  "primary",
  "hero",
  "action",
  "secondary",
  "branding",
];

export class InvalidSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSpecError";
  }
}

/**
 * Defines an ad's content and layout intent once, independent of any
 * surface. Throws at construction time (not deep in the resolver) if a
 * spec references an unknown role, a duplicate id, or a non-positive
 * priority - so a broken spec fails loudly and immediately.
 */
export function defineAd(input: {
  id: string;
  elements: readonly AdElement[];
}): AdSpec {
  const seenIds = new Set<string>();

  for (const el of input.elements) {
    if (seenIds.has(el.id)) {
      throw new InvalidSpecError(`Duplicate element id "${el.id}" in spec "${input.id}".`);
    }
    seenIds.add(el.id);

    if (!VALID_ROLES.includes(el.role)) {
      throw new InvalidSpecError(
        `Element "${el.id}" has unknown role "${el.role}". Valid roles: ${VALID_ROLES.join(", ")}.`
      );
    }

    if (!Number.isFinite(el.priority) || el.priority < 1) {
      throw new InvalidSpecError(
        `Element "${el.id}" has invalid priority "${el.priority}". Priority must be a positive number (1 = highest).`
      );
    }

    if (el.type === "image" && el.aspectRatio !== undefined && el.aspectRatio <= 0) {
      throw new InvalidSpecError(`Element "${el.id}" has a non-positive aspectRatio.`);
    }

    if ((el.type === "text" || el.type === "button") && !el.content) {
      throw new InvalidSpecError(
        `Element "${el.id}" is type "${el.type}" but has no content - the resolver cannot measure text it cannot see.`
      );
    }
  }

  if (input.elements.length === 0) {
    throw new InvalidSpecError(`Spec "${input.id}" has no elements.`);
  }

  return { id: input.id, elements: input.elements };
}

/** Convenience constructors - not required, but keep call sites readable. */
export const text = (el: Omit<AdElement, "type">): AdElement => ({ ...el, type: "text" });
export const image = (el: Omit<AdElement, "type">): AdElement => ({ ...el, type: "image" });
export const button = (el: Omit<AdElement, "type">): AdElement => ({ ...el, type: "button" });
