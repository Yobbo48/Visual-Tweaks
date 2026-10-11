const enums = {
  display: ["block"],
  "align-self": [
    "auto",
    "start",
    "end",
    "center",
    "stretch",
    "flex-start",
    "flex-end",
  ],
  "justify-self": ["auto", "start", "end", "center", "stretch"],
  "justify-items": ["normal", "start", "end", "center", "stretch"],
  position: ["static", "relative", "sticky"],
  "text-align": ["left", "center", "right", "justify", "start", "end"],
  "align-items": [
    "normal",
    "start",
    "end",
    "center",
    "stretch",
    "baseline",
    "flex-start",
    "flex-end",
  ],
  "justify-content": [
    "normal",
    "start",
    "end",
    "center",
    "space-between",
    "space-around",
    "space-evenly",
    "flex-start",
    "flex-end",
  ],
  "background-size": ["cover", "contain", "auto"],
  "background-repeat": ["no-repeat", "repeat"],
  "object-fit": ["fill", "contain", "cover", "none", "scale-down"],
  visibility: ["visible", "hidden"],
  "border-style": ["none", "solid", "dashed", "dotted"],
  "font-style": ["normal", "italic"],
  "text-transform": ["none", "uppercase", "lowercase", "capitalize"],
};
const lengths = new Set([
  "translateX",
  "translateY",
  "width",
  "height",
  "max-width",
  "min-width",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "gap",
  "font-size",
  "letter-spacing",
  "border-radius",
  "border-width",
]);
export function validValue(property, value) {
  if (
    typeof value !== "string" ||
    value.length > (property === "font-family" ? 240 : 80)
  )
    return false;
  if (enums[property]) return enums[property].includes(value);
  if (property === "font-family")
    return /^(?:"[\p{L}\p{N} _-]{1,80}"|[a-zA-Z][a-zA-Z0-9 -]{0,79})(?:, (?:"[\p{L}\p{N} _-]{1,80}"|[a-zA-Z][a-zA-Z0-9 -]{0,79})){0,5}$/u.test(
      value,
    );
  if (lengths.has(property)) {
    if (value === "fit-content") return property === "width";
    if (value === "auto")
      return (
        property.startsWith("margin-") || ["width", "height"].includes(property)
      );
    if (value === "none") return property === "max-width";
    const match = value.match(
      /^(-?(?:\d{1,5}(?:\.\d{1,4})?|\.\d{1,4}))(px|%|rem|em|vw|vh)?$/,
    );
    return (
      !!match &&
      (Number(match[1]) === 0 || !!match[2]) &&
      (Number(match[1]) >= 0 ||
        ["translateX", "translateY", "letter-spacing"].includes(property) ||
        property.startsWith("margin-"))
    );
  }
  if (["color", "background-color", "border-color"].includes(property))
    return /^(?:#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6}|#[a-fA-F0-9]{8}|transparent|currentColor)$/.test(
      value,
    );
  if (property === "opacity")
    return (
      value.trim() !== "" &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
      Number(value) <= 1
    );
  if (property === "font-weight") return /^[1-9]00$/.test(value);
  if (property === "z-index")
    return value === "auto" || /^-?\d{1,6}$/.test(value);
  if (property === "line-height")
    return /^(?:normal|(?:\d{1,3}(?:\.\d{1,4})?|\.\d{1,4})(?:px|%|rem|em)?)$/.test(
      value,
    );
  if (property === "imageZoom") return /^1\d{2}$|^200$/.test(value);
  if (property === "overlay-color")
    return /^(?:#[a-fA-F0-9]{6}|#[a-fA-F0-9]{8}|transparent)$/.test(value);
  if (property === "box-shadow")
    return (
      value === "none" ||
      /^(?:-?\d{1,3}px ){2}\d{1,3}px -?\d{1,3}px #[a-fA-F0-9]{8}$/.test(value)
    );
  if (property === "filter")
    return /^blur\((?:[0-9]|1[0-2])px\)$/.test(value) || value === "none";
  if (["object-position", "background-position"].includes(property))
    return (
      /^(?:100|[0-9]{1,2})(?:\.\d{1,2})?% (?:100|[0-9]{1,2})(?:\.\d{1,2})?%$/.test(
        value,
      ) && value.split(" ").every((v) => parseFloat(v) <= 100)
    );
  return false;
}
export function validHref(value) {
  if (value === "") return true;
  if (/[\x00-\x20<>"\\]/.test(value) || value.startsWith("//")) return false;
  return (
    /^(?:https?:\/\/|mailto:|tel:)/i.test(value) || !/^[^/?#]*:/.test(value)
  );
}

// Only explicit edits/overrides enter here; computed theme values stay in placeholders.
export function canonicalValue(property, value, pixels = false) {
  if (typeof value !== "string") return null;
  value = value.trim();
  if (value === "") return "";
  if (lengths.has(property)) {
    const match = value.match(
      /^(-?(?:\d{1,5}(?:\.\d+)?|\.\d+))(px|%|rem|em|vw|vh)?$/,
    );
    if (match && value.length <= 80) {
      const number = Number(Number(match[1]).toFixed(4));
      const unit = match[2] || (pixels && number !== 0 ? "px" : "");
      value = `${number}${unit}`;
    }
  }
  return validValue(property, value) ? value : null;
}

export function invalidOverride(elements) {
  for (const element of elements)
    for (const [breakpoint, values] of Object.entries(element.changes || {}))
      for (const [property, value] of Object.entries(values))
        if (!validValue(property, value))
          return {
            element: element.id,
            breakpoint,
            property,
            value,
            type: typeof value,
          };
  return null;
}
