import { canonicalValue } from "./validation.js?ver=0.4.4";

// PHP serializes empty arrays as []; these fields are maps, including in old drafts.
export function normalizeElements(elements) {
  return structuredClone(elements).map((element) => {
    element.changes = Object.assign({}, element.changes);
    for (const mode of Object.keys(element.changes)) {
      element.changes[mode] = Object.assign({}, element.changes[mode]);
      // Repair precision from old gestures, only for numeric lengths already stored
      // as overrides. Never read/serialize computed styles or discard invalid edits.
      for (const [property, value] of Object.entries(element.changes[mode])) {
        if (
          typeof value !== "string" ||
          !/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|%|rem|em|vw|vh)$/.test(value)
        )
          continue;
        const canonical = canonicalValue(property, value);
        if (canonical !== null) element.changes[mode][property] = canonical;
      }
    }
    return element;
  });
}
