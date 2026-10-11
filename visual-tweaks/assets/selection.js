import { backgroundLayers } from "./background-layers.js?ver=0.4.5";
const safeName = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const unstableClass = /^(?:is-|has-|active$|focus$|hover$|selected$|vt-)/;
const forbidden =
  "html,body,script,style,link,meta,noscript,iframe,form,input,textarea,select,option,[contenteditable],#wpadminbar,#vt-editor-host,.media-modal,.media-modal-backdrop";
export const textTags = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
  "strong",
  "em",
  "a",
  "button",
  "li",
  "small",
  "figcaption",
]);
export function editable(node) {
  if (node?.hasAttribute?.("data-vt-inline-edit"))
    return (
      node.namespaceURI === "http://www.w3.org/1999/xhtml" &&
      textTags.has(node.localName) &&
      !node.closest("#wpadminbar,[data-vt-ignore]")
    );
  return (
    node?.nodeType === 1 &&
    (node.namespaceURI === "http://www.w3.org/1999/xhtml" ||
      node.localName === "svg") &&
    !node.matches(forbidden) &&
    !node.closest(
      "#wpadminbar,#vt-editor-host,.media-modal,[contenteditable],[data-vt-ignore]",
    )
  );
}
export function selectionTarget(node) {
  if (node?.nodeType !== 1) node = node?.parentElement;
  if (!node) return null;
  const svg = node.closest("svg");
  if (svg) node = svg;
  if (node.localName === "picture" || node.localName === "source")
    node = node.closest("picture")?.querySelector("img") || null;
  return editable(node) ? node : null;
}
export function backgroundSource(node, originalValue) {
  const value =
    originalValue ??
    node.ownerDocument.defaultView.getComputedStyle(node).backgroundImage;
  const matches = [
    ...value.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g),
  ];
  if (!matches.length) return null;
  const src = matches[0][1] ?? matches[0][2] ?? matches[0][3];
  return {
    src: src.trim(),
    value,
    replaceable: backgroundLayers(value).some((layer) => layer.src),
  };
}
export function canEditText(node) {
  return (
    node.namespaceURI === "http://www.w3.org/1999/xhtml" &&
    textTags.has(node.localName) &&
    node.childElementCount === 0 &&
    node.textContent.length <= 4000
  );
}
export function stableClasses(node) {
  return [...node.classList]
    .filter((c) => safeName.test(c) && !unstableClass.test(c))
    .slice(0, 30);
}
function unique(doc, selector, node) {
  const matches = doc.querySelectorAll(selector);
  return matches.length === 1 && matches[0] === node;
}
function anchor(node) {
  return node.getAttribute("data-vt-id") || node.id || "";
}
export function fingerprint(node) {
  const fp = { tag: node.localName, classes: stableClasses(node) };
  if (anchor(node)) fp.anchor = anchor(node);
  if (canEditText(node)) fp.text = node.textContent;
  const background = backgroundSource(node);
  if (background) fp.background = background.value;
  if (node.localName === "img") fp.src = node.getAttribute("src") || "";
  return fp;
}
export function identify(node) {
  const doc = node.ownerDocument;
  const key = node.getAttribute("data-vt-id");
  if (key && /^[a-zA-Z0-9_-]{1,100}$/.test(key)) {
    const selector = `[data-vt-id="${key}"]`;
    if (unique(doc, selector, node))
      return {
        id: key,
        selector,
        strategy: "data",
        fingerprint: fingerprint(node),
        changes: {},
      };
  }
  if (node.id && safeName.test(node.id) && unique(doc, `#${node.id}`, node))
    return {
      id: token(),
      selector: `#${node.id}`,
      strategy: "id",
      fingerprint: fingerprint(node),
      changes: {},
    };
  const classes = stableClasses(node).slice(0, 3);
  for (let count = 1; count <= classes.length; count++) {
    const selector =
      node.localName +
      classes
        .slice(0, count)
        .map((c) => `.${c}`)
        .join("");
    if (unique(doc, selector, node))
      return {
        id: token(),
        selector,
        strategy: "class",
        fingerprint: fingerprint(node),
        changes: {},
      };
  }
  const parts = [];
  let cursor = node;
  while (cursor && cursor !== doc.body && parts.length < 5) {
    if (
      cursor.id &&
      safeName.test(cursor.id) &&
      unique(doc, `#${cursor.id}`, cursor)
    ) {
      parts.unshift(`#${cursor.id}`);
      break;
    }
    let part =
      cursor.localName +
      stableClasses(cursor)
        .slice(0, 2)
        .map((c) => `.${c}`)
        .join("");
    const siblings = [...(cursor.parentElement?.children || [])].filter(
      (n) => n.localName === cursor.localName,
    );
    if (siblings.length > 1)
      part += `:nth-of-type(${siblings.indexOf(cursor) + 1})`;
    parts.unshift(part);
    if (unique(doc, parts.join(" > "), node)) break;
    cursor = cursor.parentElement;
  }
  const selector = parts.join(" > ");
  if (selector.length > 500 || !unique(doc, selector, node))
    throw new Error(
      "Cible ambiguë. Ajoutez un id unique ou data-vt-id dans le thème.",
    );
  return {
    id: token(),
    selector,
    strategy: "hierarchy",
    fingerprint: fingerprint(node),
    changes: {},
  };
}
function token() {
  return `vt-${crypto.randomUUID()}`;
}
export function matchesFingerprint(node, fp, original) {
  if (
    !editable(node) ||
    node.localName !== fp.tag ||
    !fp.classes.every((c) => node.classList.contains(c))
  )
    return false;
  if (fp.anchor && anchor(node) !== fp.anchor) return false;
  if (fp.text !== undefined && (original?.text ?? node.textContent) !== fp.text)
    return false;
  if (
    fp.src !== undefined &&
    (original?.attributes?.src ?? node.getAttribute("src") ?? "") !== fp.src
  )
    return false;
  if (
    fp.background !== undefined &&
    (original?.background ?? backgroundSource(node)?.value) !== fp.background
  )
    return false;
  return true;
}
export function resolve(doc, entry, originals) {
  try {
    const matches = doc.querySelectorAll(entry.selector);
    if (matches.length !== 1) return null;
    const node = matches[0];
    return matchesFingerprint(node, entry.fingerprint, originals?.get(node))
      ? node
      : null;
  } catch {
    return null;
  }
}
