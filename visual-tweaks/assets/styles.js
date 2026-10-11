import {
  replaceBackgroundLayers,
  backgroundLayers,
} from "./background-layers.js?ver=0.4.4";
export const BREAKPOINTS = { desktop: 0, tablet: 1023, mobile: 767 };
export function declarations(properties, inherited = {}) {
  const lines = [];
  if ("translateX" in properties || "translateY" in properties) {
    const x = properties.translateX ?? inherited.translateX ?? "0px";
    const y = properties.translateY ?? inherited.translateY ?? "0px";
    lines.push(
      `  translate: calc(var(--vt-base-x, 0px) + ${x}) calc(var(--vt-base-y, 0px) + ${y}) !important;`,
    );
  }
  for (const [property, value] of Object.entries(properties))
    if (property === "overlay-color")
      lines.push(`  --vt-overlay-color: ${value} !important;`);
    else if (!["translateX", "translateY", "imageZoom"].includes(property))
      lines.push(`  ${property}: ${value} !important;`);
  return lines.join("\n");
}
export function generateCSS(
  elements,
  bases = new Map(),
  backgrounds = new Map(),
) {
  const buckets = { desktop: [], tablet: [], mobile: [] };
  for (const entry of elements) {
    const selector = `[data-vt-target="${entry.id}"]`;
    const background = backgrounds.get(entry.id);
    const imageSrc =
      entry.content?.assetKind === "background"
        ? entry.content.image?.src
        : background?.src;
    const hasOverlay = Object.values(entry.changes).some(
      (values) => "overlay-color" in values,
    );
    const replacements = entry.content?.backgroundLayers || [];
    let backgroundValue =
      background?.value ||
      (imageSrc ? `url(${JSON.stringify(imageSrc)})` : null);
    if (replacements.length && backgroundValue)
      backgroundValue = replaceBackgroundLayers(backgroundValue, replacements);
    else if (entry.content?.assetKind === "background" && imageSrc)
      backgroundValue = backgroundValue
        ? replaceBackgroundLayers(backgroundValue, [
            {
              layer: backgroundLayers(backgroundValue).find(
                (layer) => layer.src,
              )?.index,
              image: { src: imageSrc },
            },
          ])
        : `url(${JSON.stringify(imageSrc)})`;
    if (
      backgroundValue &&
      (hasOverlay ||
        replacements.length ||
        entry.content?.assetKind === "background")
    )
      buckets.desktop.push(
        `${selector} {\n  ${hasOverlay ? "--vt-overlay-color: transparent;\n  " : ""}background-image: ${hasOverlay ? "linear-gradient(var(--vt-overlay-color, transparent), var(--vt-overlay-color, transparent)), " : ""}${backgroundValue} !important;\n}`,
      );
    const base = bases.get(entry.id);
    if (base)
      buckets.desktop.push(
        `${selector} {\n  --vt-base-x: ${base[0]};\n  --vt-base-y: ${base[1]};\n}`,
      );
    let inherited = {};
    for (const mode of Object.keys(BREAKPOINTS)) {
      const values = entry.changes[mode] || {};
      let body = declarations(values, inherited);
      const effective = { ...inherited, ...values };
      if ("imageZoom" in effective) {
        const zoom = Number(effective.imageZoom) / 100;
        if (background?.width && background?.height) {
          const fit = effective["background-size"] || background.fit;
          const scale =
            fit === "auto"
              ? 1
              : (fit === "contain" ? Math.min : Math.max)(
                  background.boxW / background.width,
                  background.boxH / background.height,
                );
          body += `\n  background-size: ${Math.round(background.width * scale * zoom)}px ${Math.round(background.height * scale * zoom)}px !important;`;
        } else if (entry.fingerprint.tag === "img")
          body += `\n  object-view-box: inset(${((1 - 1 / zoom) * 50).toFixed(2)}%) !important;`;
      }
      if (body)
        buckets[mode].push(
          `/* ${entry.selector} */\n${selector} {\n${body}\n}`,
        );
      inherited = { ...inherited, ...values };
    }
  }
  let css =
    "/* Visual Tweaks — overrides de cette page */\n" +
    buckets.desktop.join("\n");
  for (const mode of ["tablet", "mobile"])
    if (buckets[mode].length)
      css += `\n@media (max-width: ${BREAKPOINTS[mode]}px) {\n${buckets[mode].join("\n")}\n}`;
  return css;
}
export function effectiveProperties(entry, mode) {
  let result = {};
  for (const current of Object.keys(BREAKPOINTS)) {
    result = { ...result, ...entry.changes[current] };
    if (current === mode) break;
  }
  return result;
}

export function propertyOrigin(entry, mode, property) {
  let origin = null;
  for (const current of Object.keys(BREAKPOINTS)) {
    if (entry?.changes[current]?.[property] !== undefined) origin = current;
    if (current === mode) break;
  }
  return origin;
}
