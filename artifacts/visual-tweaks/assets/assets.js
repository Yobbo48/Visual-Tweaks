import {
  editable,
  selectionTarget,
  backgroundSource,
  canEditText,
  stableClasses,
} from "./selection.js?ver=0.3.3";
export function assetInfo(node) {
  if (!node) return null;
  if (node.localName === "img")
    return {
      kind: "image",
      type:
        node.parentElement?.localName === "picture"
          ? "Image adaptative"
          : "Image",
      src: node.currentSrc || node.src,
      replaceable: true,
      name: node.alt,
    };
  if (node.localName === "svg")
    return {
      kind: "svg",
      type: "Icône SVG",
      src: "",
      replaceable: false,
      name:
        node.getAttribute("aria-label") ||
        node.querySelector("title")?.textContent ||
        "Icône",
    };
  const background = backgroundSource(node);
  if (background)
    return {
      kind: "background",
      type: "Image de fond",
      ...background,
      replaceable:
        backgroundSource(
          node,
          node.ownerDocument.defaultView.VisualTweaksRuntime?.originals.get(
            node,
          )?.background,
        )?.replaceable ?? background.replaceable,
      name: node.getAttribute("aria-label") || "",
    };
  return null;
}
export function labelFor(node) {
  const asset = assetInfo(node);
  if (asset)
    return asset.kind === "svg"
      ? "Icône"
      : asset.kind === "background"
        ? "Image de fond"
        : "Image";
  if (["a", "button"].includes(node.localName)) return "Bouton";
  if (canEditText(node))
    return node.localName.startsWith("h") ? "Titre" : "Texte";
  if (node.localName === "section") return "Section";
  return "Zone";
}
export function areaFor(node) {
  const zone = node.closest("header,footer,section,article,main,figure");
  return (
    zone?.getAttribute("aria-label") ||
    zone?.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 55) ||
    ({
      header: "En-tête",
      footer: "Pied de page",
      main: "Page",
      section: "Section",
      article: "Bloc",
      figure: "Illustration",
    }[zone?.localName] ??
      "Page")
  );
}
export function imageSources(value) {
  return [...value.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/gi)]
    .map((match) => (match[1] ?? match[2] ?? match[3]).trim())
    .filter(Boolean);
}
export function assetInventory(doc) {
  const list = [],
    seen = new Set(),
    win = doc.defaultView;
  function add(node, asset) {
    let filename = "";
    try {
      filename = decodeURIComponent(
        new URL(asset.src, doc.baseURI).pathname.split("/").pop(),
      );
    } catch {}
    list.push({
      ...asset,
      node,
      filename,
      name: (asset.name || filename || asset.type).slice(0, 90),
      area: areaFor(node),
      width: node.offsetWidth ?? Math.round(node.getBoundingClientRect().width),
      height:
        node.offsetHeight ?? Math.round(node.getBoundingClientRect().height),
    });
  }
  // Scan all eligible occurrences, including hidden assets. SVG internals are never separate assets.
  for (const candidate of doc.querySelectorAll("body *")) {
    const node = selectionTarget(candidate);
    if (!node || seen.has(node)) continue;
    seen.add(node);
    if (node.localName === "img" || node.localName === "svg") {
      add(node, assetInfo(node));
      continue;
    }
    const background = assetInfo(node);
    if (background)
      for (const [layer, src] of imageSources(background.value).entries())
        add(node, {
          ...background,
          src,
          layer,
          name: background.name,
          replaceable: background.replaceable,
        });
    for (const pseudo of ["::before", "::after"]) {
      const style = win.getComputedStyle(node, pseudo);
      if (["none", "normal"].includes(style.content)) continue;
      for (const [layer, src] of imageSources(style.backgroundImage).entries())
        add(node, {
          kind: "pseudo",
          type: "Décor de fond",
          src,
          pseudo,
          layer,
          replaceable: false,
          name: "",
          value: style.backgroundImage,
        });
    }
  }
  return list;
}
export function groupAssets(list) {
  const groups = new Map();
  for (const item of list) {
    const key = item.src || `svg:${item.node.innerHTML}`;
    if (!groups.has(key))
      groups.set(key, { name: item.filename || item.name, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}
export function structureInventory(doc) {
  const list = [],
    seen = new Set();
  function visit(parent, parentItem = null, depth = 0) {
    for (const candidate of parent.children) {
      if (
        candidate.matches(
          "script,style,link,meta,noscript,iframe,#wpadminbar,#vt-editor-host,[data-vt-ignore],.media-modal",
        )
      )
        continue;
      const node = selectionTarget(candidate);
      if (!node) {
        visit(candidate, parentItem, depth);
        continue;
      }
      if (seen.has(node)) continue;
      seen.add(node);
      const item = {
        node,
        parent: parentItem,
        children: [],
        depth,
        type: labelFor(node),
        label:
          node.getAttribute("aria-label") ||
          { header: "En-tête", footer: "Pied de page", main: "Page" }[
            node.localName
          ] ||
          (canEditText(node)
            ? node.textContent.trim().slice(0, 50)
            : node.getAttribute("data-vt-id") ||
              node.id ||
              stableClasses(node).slice(0, 2).join(" · ") ||
              node.localName),
      };
      list.push(item);
      parentItem?.children.push(item);
      // A background is a decoration of a container: its children still belong to Structure.
      if (!["img", "svg"].includes(node.localName))
        visit(node, item, depth + 1);
    }
  }
  visit(doc.body);
  return list;
}

// Thumbnail copies only graphic primitives; no scripts, foreignObject, links or events.
export function svgThumbnail(source, doc) {
  const tags = new Set([
    "svg",
    "g",
    "path",
    "circle",
    "ellipse",
    "rect",
    "line",
    "polyline",
    "polygon",
  ]);
  const attributes = new Set([
    "viewBox",
    "d",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "width",
    "height",
    "points",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "fill-rule",
    "opacity",
    "transform",
  ]);
  let budget = 1000;
  function copy(node, path = new Set()) {
    if (!node || path.has(node) || path.size > 15 || --budget < 0) return null;
    const next = new Set(path).add(node);
    if (node.localName === "use") {
      const href =
        node.getAttribute("href") || node.getAttribute("xlink:href") || "";
      if (!href.startsWith("#")) return null;
      const target = copy(
        source.ownerDocument.getElementById(href.slice(1)),
        next,
      );
      if (!target) return null;
      const wrapper = doc.createElementNS("http://www.w3.org/2000/svg", "g");
      const x = Number(node.getAttribute("x") || 0),
        y = Number(node.getAttribute("y") || 0);
      if (Number.isFinite(x) && Number.isFinite(y))
        wrapper.setAttribute("transform", `translate(${x} ${y})`);
      wrapper.append(target);
      return wrapper;
    }
    if (!tags.has(node.localName) && node.localName !== "symbol") return null;
    const clone = doc.createElementNS(
      "http://www.w3.org/2000/svg",
      node.localName === "symbol" ? "svg" : node.localName,
    );
    for (const attribute of node.attributes) {
      if (
        attributes.has(attribute.name) &&
        attribute.value.length <= 16000 &&
        !/url\s*\(/i.test(attribute.value)
      )
        clone.setAttribute(attribute.name, attribute.value);
    }
    for (const child of node.children) {
      const safe = copy(child, next);
      if (safe) clone.append(safe);
    }
    return clone;
  }
  const thumb = copy(source);
  thumb.setAttribute("aria-hidden", "true");
  thumb.setAttribute("focusable", "false");
  thumb.style.color =
    source.ownerDocument.defaultView.getComputedStyle(source).color;
  return thumb;
}
