import { declarations } from "./styles.js?ver=0.4.4";

// Editor-only transient CSS: the public runtime never loads this gesture controller.
export class GesturePreview {
  constructor(doc) {
    this.doc = doc;
    this.count = 0;
  }
  begin(node) {
    this.end();
    const computed = this.doc.defaultView.getComputedStyle(node);
    const parts =
      computed.translate === "none"
        ? ["0px", "0px"]
        : computed.translate.split(" ");
    const style = this.doc.createElement("style");
    style.id = "vt-gesture-styles";
    this.doc.head.append(style);
    this.gesture = {
      node,
      style,
      attribute: node.getAttribute("data-vt-gesture"),
      bases: [
        computed.getPropertyValue("--vt-base-x").trim() || parts[0],
        computed.getPropertyValue("--vt-base-y").trim() || parts[1] || "0px",
      ],
    };
    node.setAttribute("data-vt-gesture", "active");
  }
  render(values, inherited) {
    if (!this.gesture) return;
    this.count++;
    const { style, bases } = this.gesture;
    style.textContent = `[data-vt-gesture="active"] {\n  --vt-base-x: ${bases[0]};\n  --vt-base-y: ${bases[1]};\n${declarations(values, inherited)}\n}`;
  }
  end() {
    if (!this.gesture) return;
    const { node, style, attribute } = this.gesture;
    if (attribute === null) node.removeAttribute("data-vt-gesture");
    else node.setAttribute("data-vt-gesture", attribute);
    style.remove();
    this.gesture = null;
  }
}
