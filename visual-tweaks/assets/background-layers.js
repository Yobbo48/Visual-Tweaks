// Split only top-level commas; preserve quoted URLs and nested gradient/image functions.
export function splitBackground(value) {
  const layers = [];
  let start = 0,
    depth = 0,
    quote = null,
    escaped = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      layers.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (quote || depth !== 0) return [];
  layers.push(value.slice(start).trim());
  return layers;
}
export function backgroundLayers(value) {
  return splitBackground(value).map((raw, index) => {
    const match = raw.match(
      /^url\(\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^)]*))\s*\)$/i,
    );
    const src = match
      ? (match[1] ?? match[2] ?? match[3]).trim().replace(/\\([\\'"])/g, "$1")
      : null;
    return {
      index,
      raw,
      src,
      kind: src ? "image" : /gradient\(/i.test(raw) ? "gradient" : "other",
    };
  });
}
export function replaceBackgroundLayers(value, replacements) {
  const layers = backgroundLayers(value);
  for (const replacement of replacements) {
    const layer = layers[replacement.layer];
    if (!layer?.src || !replacement.image?.src) return null;
    layer.raw = `url(${JSON.stringify(replacement.image.src)})`;
  }
  return layers.map((layer) => layer.raw).join(", ");
}
