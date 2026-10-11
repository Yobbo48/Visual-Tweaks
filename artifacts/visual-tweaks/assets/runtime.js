import {
  resolve,
  canEditText,
  backgroundSource,
} from "./selection.js?ver=0.3.3";
import { generateCSS } from "./styles.js?ver=0.3.3";

export class Runtime {
  constructor(doc, elements) {
    this.doc = doc;
    this.elements = elements;
    this.originals = new Map();
    this.targets = new Map();
    this.issues = [];
    this.images = new Map();
    this.style = doc.createElement("style");
    this.style.id = "vt-generated-styles";
    doc.head.append(this.style);
    this.resize = () => this.render(this.elements);
    doc.defaultView.addEventListener("resize", this.resize);
    this.render(elements);
  }
  remember(node) {
    if (this.originals.has(node)) return;
    const attributes = {};
    for (const attr of ["src", "srcset", "sizes", "alt", "href"])
      attributes[attr] = node.getAttribute(attr);
    this.originals.set(node, {
      text: node.textContent,
      attributes,
      background: backgroundSource(node)?.value,
    });
  }
  restore() {
    this.style.textContent = "";
    for (const [node, original] of this.originals) {
      node.removeAttribute("data-vt-target");
      if (node !== this.editingNode) {
        if (original.textChanged && canEditText(node))
          node.textContent = original.text;
        original.textChanged = false;
      }
      if (original.linkChanged) {
        const href = original.attributes.href;
        if (href === null) node.removeAttribute("href");
        else node.setAttribute("href", href);
        original.linkChanged = false;
      }
      if (original.imageChanged && node.localName === "img")
        for (const [attr, value] of Object.entries(original.attributes)) {
          if (value === null) node.removeAttribute(attr);
          else node.setAttribute(attr, value);
        }
      if (node.localName === "img")
        for (const source of node.parentElement?.localName === "picture"
          ? node.parentElement.querySelectorAll("source")
          : []) {
          if (source.dataset.vtOriginalSrcset !== undefined) {
            source.setAttribute("srcset", source.dataset.vtOriginalSrcset);
            delete source.dataset.vtOriginalSrcset;
          }
        }
      original.imageChanged = false;
    }
  }
  render(elements) {
    this.restore();
    this.elements = structuredClone(elements);
    this.issues = [];
    this.targets.clear();
    const bases = new Map();
    const valid = [];
    const backgrounds = new Map();
    for (const entry of elements) {
      const node = resolve(this.doc, entry, this.originals);
      if (!node) {
        this.issues.push(entry);
        continue;
      }
      this.remember(node);
      const background = backgroundSource(node);
      if (background) {
        const src =
          entry.content?.assetKind === "background"
            ? entry.content.image?.src || background.src
            : background.src;
        if (!this.images.has(src)) {
          const image = new this.doc.defaultView.Image();
          this.images.set(src, image);
          image.onload = () => {
            if (this.style.isConnected) this.render(this.elements);
          };
          image.src = src;
        }
        const image = this.images.get(src);
        backgrounds.set(entry.id, {
          src,
          fit: this.doc.defaultView.getComputedStyle(node).backgroundSize,
          width: image.naturalWidth,
          height: image.naturalHeight,
          boxW: node.clientWidth,
          boxH: node.clientHeight,
        });
      }
      const translate = this.doc.defaultView.getComputedStyle(node).translate;
      const parts =
        translate === "none" ? ["0px", "0px"] : translate.split(" ");
      bases.set(entry.id, [parts[0] || "0px", parts[1] || "0px"]);
      node.setAttribute("data-vt-target", entry.id);
      this.targets.set(entry.id, node);
      valid.push(entry);
      if (entry.content?.text !== undefined && canEditText(node)) {
        if (node !== this.editingNode) node.textContent = entry.content.text;
        this.originals.get(node).textChanged = true;
      }
      if (entry.content?.href !== undefined && node.localName === "a") {
        if (entry.content.href === "") node.removeAttribute("href");
        else node.setAttribute("href", entry.content.href);
        this.originals.get(node).linkChanged = true;
      }
      if (entry.content?.image && node.localName === "img") {
        this.originals.get(node).imageChanged = true;
        for (const source of node.parentElement?.localName === "picture"
          ? node.parentElement.querySelectorAll("source")
          : []) {
          source.dataset.vtOriginalSrcset = source.getAttribute("srcset") || "";
          source.removeAttribute("srcset");
        }
        node.removeAttribute("srcset");
        node.removeAttribute("sizes");
        node.setAttribute("src", entry.content.image.src);
        node.setAttribute("alt", entry.content.image.alt || "");
      }
    }
    this.style.textContent = generateCSS(valid, bases, backgrounds);
    // Read final responsive dimensions before calculating a background zoom.
    for (const [id, background] of backgrounds) {
      const node = this.targets.get(id);
      background.boxW = node.clientWidth;
      background.boxH = node.clientHeight;
    }
    if (backgrounds.size)
      this.style.textContent = generateCSS(valid, bases, backgrounds);
    return this.issues;
  }
  destroy() {
    this.restore();
    this.style.remove();
    this.doc.defaultView.removeEventListener("resize", this.resize);
  }
}
if (window.VisualTweaksConfig)
  window.VisualTweaksRuntime = new Runtime(
    document,
    window.VisualTweaksConfig.elements,
  );
